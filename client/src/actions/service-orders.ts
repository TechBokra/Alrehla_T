'use server';
import { requireAdmin, getDependentGuardian } from '@/lib/auth-guard';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { hasAdminPermission, calculateFinalSessionPrice } from '@/lib/utils';
import { notifyUser, notifyAdmins, getInstructorUserId, getProviderUserId } from '@/lib/notifications';
import { SERVICE_DUE_DAYS } from '@/lib/service-delivery';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { briefMessage } from '@/lib/service-details';
import { isValidReceiptRef } from '@/lib/receipt-ref';
import { staffPurchaseBlock } from '@/lib/buying-roles';

/**
 * Ordering a standalone creative service.
 *
 * Creative services are deliberately kept out of the products cart: the
 * database models them separately (service_orders, not orders/order_items),
 * and a service tied to one instructor at one price behaves more like a
 * booking than a basket item.
 *
 * Payment is the same manual transfer flow the rest of the platform uses —
 * the customer transfers, gives the reference, and an admin verifies.
 */
type CreateServiceOrderParams = {
  serviceId: string;
  /** مقدّم الخدمة المختار. المنصة مقدّم زي أي حد. */
  providerId?: string | null;
  /** الاسم القديم — بيفضل مقبول لحد ما كل الروابط تتحدّث. */
  instructorId?: string | null;
  /**
   * لمين الخدمة.
   *
   * حجز الباقة بيعرف ده من الأول، وطلب الخدمة **مكانش فيه خالص**:
   * ولي أمر يطلب «مراجعة نص» لابنه، والطلب يتسجّل باسمه هو، ومقدّم
   * الخدمة اللي هينفّذ مايعرفش النص لمين ولا سنه كام — وده فرق كبير
   * في خدمة تربوية للأطفال.
   */
  participantType?: 'self' | 'child';
  childId?: string | null;
  /**
   * «تفاصيل طلبك» — العميل بيكتب هو عايز إيه بالظبط.
   *
   * ⚠️ مالهاش خانة في الطلب عن قصد: بتتحفظ **كأول رسالة في محادثة
   *    الطلب**، فمقدّم الخدمة بيلاقيها في نفس المكان اللي هيرد فيه.
   */
  brief?: string | null;
  /** كود خصم (ملف 13) — القاعدة بتتحقق منه وبتحسبه. */
  discountCode?: string | null;
};

/**
 * نتيجة كل عمليات طلبات الخدمة.
 *
 * ⚠️ **كل الدوال هنا بترجّع ولا بترمي** (قاعدة «هـ»): Next بيمسح رسالة
 *    أي خطأ بيترمي من أكشن في الإنتاج، فالعميل ومقدّم الخدمة والإدارة
 *    كانوا بيشوفوا رسالة إنجليزي عامة بدل السبب العربي.
 *    `field` (اختياري) = الخانة اللي فيها المشكلة، للشاشة.
 */
export type ServiceOrderResult = { ok: true } | { ok: false; error: string; field?: string };
type Fail = { ok: false; error: string; field?: string };

const fail = (error: string, field?: string): Fail => (field ? { ok: false, error, field } : { ok: false, error });
const errMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export type CreateServiceOrderResult =
  | { ok: true; orderId: string; amount: number; paymentReference: string; warning?: string }
  | Fail;

/**
 * ⚠️ **بترجّع ولا بترمي** (قاعدة «هـ»): الرسالة اللي بتترمي من أكشن
 *    Next بيمسحها في الإنتاج، فالعميل كان بيشوف رسالة إنجليزي عامة بدل
 *    «كود الخصم ده انتهى» أو «مقدّم الخدمة غير متاح». الفحوص جوّه بقت
 *    بترجّع نتيجة، والغلاف ده فاضل شبكة أمان لأي عطل مش متوقَّع.
 */
export async function createServiceOrder(params: CreateServiceOrderParams): Promise<CreateServiceOrderResult> {
  try {
    return await createServiceOrderInner(params);
  } catch (err) {
    console.error('Unexpected error creating service order', err);
    return fail(errMessage(err, 'تعذّر إنشاء الطلب'));
  }
}

async function createServiceOrderInner(params: CreateServiceOrderParams): Promise<CreateServiceOrderResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('يجب تسجيل الدخول أولاً');

  // حساب الطفل التابع ممنوع من الطلب المباشر — يمر على ولي أمره.
  // (`getDependentGuardian` بترمي لو التحقق نفسه فشل — بنحوّلها لنتيجة.)
  let dependent: Awaited<ReturnType<typeof getDependentGuardian>>;
  try {
    dependent = await getDependentGuardian();
  } catch (err) {
    return fail(errMessage(err, 'تعذّر التحقق من نوع الحساب. جرّب تاني.'));
  }
  if (dependent) {
    return fail('طلب الخدمة محتاج موافقة ولي أمرك. كلّمه يعمله من حسابه.');
  }

  // ⚠️ حساب الشغل (مدرب/مقدّم خدمة/إداري) مايطلبش بنفس الحساب —
  //    قرار تامر (١٨ أكتوبر)، والسبب في `@/lib/buying-roles`.
  //
  //    والفحص هنا **بالدور من القاعدة** مش من اللي الشاشة بعتته
  //    (قاعدة «ف»). والمنع الحقيقي محفّز `block_suspended_purchase`
  //    على `service_orders`.
  //
  // ⚠️ ومقدّم الخدمة اللي يطلب خدمة لنفسه كان بيقدر يطلبها من نفسه:
  //    بيدفع لنفسه، والعمولة تتحسب، والسجل المالي يطلع صفًا لمعاملة
  //    مالهاش وجود.
  const buyer = await getCurrentUser();
  const staffBlock = staffPurchaseBlock(buyer.role);
  if (staffBlock) return fail(staffBlock.message);

  const { serviceId } = params;
  let providerId = params.providerId ?? null;

  // المشارك: لو فرد من العائلة، لازم يبقى **فعلًا تابع للمشتري**.
  // من غير الفحص ده أي حد يبعت رقم طفل مش بتاعه ويشوف اسمه في الطلب.
  const participantType = params.participantType === 'child' ? 'child' : 'self';
  let childId: string | null = null;

  if (participantType === 'child') {
    if (!params.childId) return fail('اختار المستفيد من الخدمة', 'childId');
    const { data: child } = await supabase
      .from('child_profiles')
      .select('id')
      .eq('id', params.childId)
      .eq('user_profile_id', user.id)
      .maybeSingle();
    if (!child) return fail('فرد العائلة ده مش على حسابك', 'childId');
    childId = child.id;
  }

  // رابط قديم بيبعت معرّف مدرب: نلاقي صف المقدّم بتاعه.
  if (!providerId && params.instructorId) {
    const { data: byInstructor } = await supabase
      .from('service_providers')
      .select('id')
      .eq('instructor_id', params.instructorId)
      .maybeSingle();
    providerId = byInstructor?.id ?? null;
  }

  const { data: service, error: serviceError } = await supabase
    .from('standalone_services')
    .select('id, price, price_type')
    .eq('id', serviceId)
    .single();

  if (serviceError || !service) return fail('الخدمة غير موجودة');

  // المبلغ ما بيتاخدش من المتصفح أبدًا. بيتحسب هنا من عرض مقدّم الخدمة
  // المعتمد، فنموذج متلاعب فيه ما يقدرش يغيّر اللي بيتحاسب.
  let amount = service.price;
  let providerEarning: number | null = null;
  let instructorId: string | null = null;

  if (providerId) {
    const { data: provider } = await supabase
      .from('service_providers')
      .select('id, kind, status, instructor_id')
      .eq('id', providerId)
      .maybeSingle();

    if (!provider || provider.status !== 'active') {
      return fail('مقدّم الخدمة غير متاح حالياً');
    }
    instructorId = provider.instructor_id;

    const { data: offer } = await supabase
      .from('provider_services')
      .select('approved_price')
      .eq('service_id', serviceId)
      .eq('provider_id', providerId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .maybeSingle();

    if (!offer || offer.approved_price == null) {
      return fail('مقدّم الخدمة لا يقدم هذه الخدمة حالياً');
    }

    if (provider.kind === 'platform') {
      // المنصة بتقدّم الخدمة بنفسها: السعر المعتمد هو سعر العميل،
      // ومفيش مستحق يتدفع لحد.
      amount = offer.approved_price;
      providerEarning = null;
    } else {
      // مدرب أو مستقل: السعر المعتمد مستحقه، والعميل بيدفع فوقه
      // معادلة المنصة — نفس قاعدة تسعير الجلسات.
      providerEarning = offer.approved_price;

      // ⚠️ **معادلة المقدّمين، مش معادلة الجلسات.** كانت `default`
      //    — يعني نصيب المنصة من الخدمة مربوط بنصيبها من الجلسة.
      const { data: formula } = await supabase
        .from('pricing_formula_settings')
        .select('platform_multiplier, fixed_admin_fee')
        .eq('id', 'provider-default')
        .maybeSingle();

      amount = formula
        ? calculateFinalSessionPrice(providerEarning, {
            platformMultiplier: formula.platform_multiplier,
            fixedAdminFee: formula.fixed_admin_fee,
          })
        : providerEarning;
    }
  } else {
    // مفيش مقدّم متحدد في الرابط: المنصة هي المسؤولة الافتراضية.
    //
    // من غير ده الطلب بيتعمل بلا مقدّم خدمة مكلَّف — فمحدش بياخد إشعار،
    // ومش بيظهر في لوحة أي مقدّم، والمهلة مالهاش مخاطَب.
    const { data: platform } = await supabase
      .from('service_providers')
      .select('id')
      .eq('kind', 'platform')
      .eq('status', 'active')
      .maybeSingle();

    const { data: platformOffer } = platform
      ? await supabase
          .from('provider_services')
          .select('approved_price')
          .eq('service_id', serviceId)
          .eq('provider_id', platform.id)
          .eq('status', 'approved')
          .eq('is_active', true)
          .maybeSingle()
      : { data: null };

    if (!platform || !platformOffer || platformOffer.approved_price == null) {
      return fail('يجب اختيار مقدّم للخدمة');
    }

    providerId = platform.id;
    amount = platformOffer.approved_price;
    providerEarning = null;
  }

  const { data: order, error } = await supabase
    .from('service_orders')
    .insert({
      buyer_profile_id: user.id,
      standalone_service_id: serviceId,
      participant_type: participantType,
      child_id: childId,
      instructor_id: instructorId,
      provider_id: providerId,
      amount,
      instructor_earning: providerEarning,
      // الطلب بيبدأ «بانتظار الدفع» دايمًا: الإيصال بيترفع في خطوة تانية
      // بعد ما العميل يشوف الرقم المرجعي ويحوّل.
      status: 'pending',
      // ⚠️ بيتبعت بس لو فيه كود — قبل ملف 13 العمود مش موجود.
      ...(params.discountCode?.trim() ? { discount_code: params.discountCode.trim() } : {}),
    })
    // ⚠️ المبلغ **من القاعدة** (ملف 13 بيحسبه هناك، ومعاه الخصم) — مش
    //    الرقم اللي اتحسب فوق.
    .select('id, payment_reference, amount')
    .single();

  if (error || !order) {
    console.error('Error creating service order', error);
    // رسائل الكود والسعر من القاعدة عربي ومفهومة («كود الخصم ده انتهى»).
    if (error?.code === 'P0001' && error.message) return fail(error.message);
    return fail('تعذّر إنشاء الطلب');
  }

  // «تفاصيل طلبك» ← أول رسالة في المحادثة. فشلها مايوقعش الطلب: الطلب
  // اتعمل والعميل يقدر يكتبها تاني في المحادثة — بس بنقوله.
  let warning: string | undefined;
  const brief = briefMessage(params.brief);
  if (brief) {
    const { error: briefError } = await supabase.from('service_order_messages').insert({
      order_id: order.id,
      sender_profile_id: user.id,
      body: brief,
      is_delivery: false,
    });
    if (briefError) {
      console.error('تعذّر حفظ تفاصيل الطلب', briefError);
      warning = 'الطلب اتسجّل، بس تفاصيلك ماوصلتش — اكتبها في محادثة الطلب من «طلباتي».';
    }
  }

  // المنصة كمقدّم مالهاش حساب شخص يتبعتله إشعار — الطلب بيظهر في
  // لوحة الإدارة أصلًا.
  if (providerId) {
    const recipient = await getProviderUserId(providerId);
    if (recipient) {
      await notifyUser({
        event: 'service_order_new',
        recipientProfileId: recipient,
        title: 'طلب خدمة جديد',
        message: 'وصلك طلب خدمة إبداعية جديد. سيظهر للتنفيذ بعد تأكيد الدفع.',
        link: `/dashboard/provider/orders/${order.id}`,
      });
    }
  }

  revalidatePath('/account/orders/creative-writing');
  revalidatePath('/dashboard/admin/orders/services');

  return {
    ok: true as const,
    orderId: order.id,
    amount: order.amount != null ? Number(order.amount) : amount,
    paymentReference: order.payment_reference ?? '',
    warning,
  };
}

/* ================================================================
 * دورة حياة الطلب بعد الدفع
 * ================================================================
 * مَن ينقل الطلب من حالة لأخرى مفروض في قاعدة البيانات أيضًا؛ الفحوص هنا
 * لرسالة خطأ واضحة، لا لأنها الحارس الوحيد.
 */

/** بترجّع نتيجة — كل منادي لازم يشيك على `ok` قبل ما يكمّل. */
async function loadOrderFor(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('يجب تسجيل الدخول أولاً');

  const { data: order } = await supabase
    .from('service_orders')
    .select('id, buyer_profile_id, instructor_id, provider_id, status, amount, instructor_earning, standalone_service_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return fail('الطلب غير موجود');
  return { ok: true as const, supabase, user, order };
}

/**
 * المستخدم ده هو مقدّم الخدمة المكلّف بالطلب؟
 *
 * ⚠️ **كان بيشوف `instructor_id` بس.** الطلبات الجديدة بتتسند لـ
 *    `provider_id` (مدرب، أو مقدّم فردي مش مدرب) — فالمقدّم الفردي كان
 *    بياخد «هذا الطلب ليس مسنَدًا إليك» على طلبه هو. نفس شرط حارس
 *    القاعدة (`guard_service_order_fields`).
 */
async function isOrderProvider(
  supabase: Awaited<ReturnType<typeof createClient>>,
  order: { instructor_id: string | null; provider_id: string | null },
  userId: string
) {
  if (order.instructor_id) {
    const { data } = await supabase
      .from('instructors')
      .select('id')
      .eq('id', order.instructor_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return true;
  }
  if (order.provider_id) {
    const providerUserId = await getProviderUserId(order.provider_id);
    if (providerUserId === userId) return true;
  }
  return false;
}

function revalidateOrder(orderId: string) {
  revalidatePath(`/account/orders/creative-writing/${orderId}`);
  revalidatePath('/account/orders/creative-writing');
  revalidatePath(`/dashboard/instructor/services/orders/${orderId}`);
  revalidatePath('/dashboard/instructor/services');
  revalidatePath(`/dashboard/provider/orders/${orderId}`);
  revalidatePath('/dashboard/provider');
  revalidatePath(`/dashboard/admin/orders/services/${orderId}`);
  revalidatePath('/dashboard/admin/orders/services');
  revalidatePath('/dashboard/admin');
}

/** رسالة في محادثة الطلب. */
export async function sendServiceOrderMessage(
  orderId: string,
  body: string,
  isDelivery = false
): Promise<ServiceOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('يجب تسجيل الدخول أولاً');

  const text = body.trim();
  if (!text) return fail('اكتب رسالة أولاً', 'body');
  if (text.length > 4000) return fail('الرسالة طويلة جدًا', 'body');

  const { error } = await supabase.from('service_order_messages').insert({
    order_id: orderId,
    sender_profile_id: user.id,
    body: text,
    is_delivery: isDelivery,
  });

  if (error) {
    console.error('Error sending order message', error);
    return fail('تعذّر إرسال الرسالة');
  }

  // The other side of the conversation hears about it.
  const { data: order } = await supabase
    .from('service_orders')
    .select('buyer_profile_id, instructor_id, provider_id')
    .eq('id', orderId)
    .maybeSingle();

  if (order && !isDelivery) {
    const providerUserId = order.provider_id
      ? await getProviderUserId(order.provider_id)
      : order.instructor_id
        ? await getInstructorUserId(order.instructor_id)
        : null;
    const recipient =
      user.id === order.buyer_profile_id ? providerUserId : order.buyer_profile_id;
    const link =
      user.id === order.buyer_profile_id
        ? `/dashboard/provider/orders/${orderId}`
        : `/account/orders/creative-writing/${orderId}`;

    await notifyUser({
      event: 'service_message',
      recipientProfileId: recipient,
      title: 'رسالة جديدة على طلب خدمة',
      message: text.slice(0, 120),
      link,
    });
  }

  revalidateOrder(orderId);
  return { ok: true };
}

/** المدرب يبدأ التنفيذ. */
export async function startServiceOrder(orderId: string): Promise<ServiceOrderResult> {
  const loaded = await loadOrderFor(orderId);
  if (!loaded.ok) return loaded;
  const { supabase, user, order } = loaded;

  if (!(await isOrderProvider(supabase, order, user.id))) {
    return fail('هذا الطلب ليس مسنَدًا إليك');
  }
  if (order.status !== 'paid') {
    return fail('لا يمكن بدء التنفيذ قبل تأكيد الدفع');
  }

  const { data: started, error } = await supabase
    .from('service_orders')
    .update({ status: 'in_progress' })
    .eq('id', orderId)
    .eq('status', 'paid')
    .select('status');

  if (error) return fail('تعذّر تحديث حالة الطلب');
  // ⚠️ حارس القاعدة بيرجّع الحالة لورا **من غير خطأ** لو الانتقال مش
  //    مسموح — فالصف بيرجع والحالة زي ما هي. كان الزرار يقول «تمام».
  if (!started || started.length === 0 || started[0].status !== 'in_progress') {
    return fail('الطلب مش موجود أو تغيّرت حالته — التغيير مروّحش للقاعدة.');
  }

  await notifyUser({
    event: 'order_status',
    recipientProfileId: order.buyer_profile_id,
    title: 'بدأ تنفيذ طلبك',
    message: 'المدرب بدأ العمل على طلبك.',
    link: `/account/orders/creative-writing/${orderId}`,
  });

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * المدرب يسلّم العمل.
 *
 * يُشترط رسالة تسليم فعلية: "تم التسليم" بلا شيء يقابله عند العميل هو بالضبط
 * ما يجعل الطلب يعلق بعد ذلك.
 */
export async function deliverServiceOrder(
  orderId: string,
  deliveryMessage: string,
): Promise<ServiceOrderResult> {
  const loaded = await loadOrderFor(orderId);
  if (!loaded.ok) return loaded;
  const { supabase, user, order } = loaded;

  if (!(await isOrderProvider(supabase, order, user.id))) {
    return fail('هذا الطلب ليس مسنَدًا إليك');
  }
  if (order.status !== 'in_progress' && order.status !== 'paid') {
    return fail('لا يمكن التسليم في هذه الحالة');
  }

  const text = deliveryMessage.trim();
  if (text.length < 10) {
    return fail('اكتب رسالة التسليم للعميل (ما الذي سلّمته وأين يجده)', 'deliveryMessage');
  }

  const { data: delivered, error } = await supabase
    .from('service_orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', orderId)
    .in('status', ['in_progress', 'paid'])
    .select('status');

  if (error) return fail('تعذّر تسجيل التسليم');
  if (!delivered || delivered.length === 0 || delivered[0].status !== 'delivered') {
    return fail('الطلب مش موجود أو تغيّرت حالته — التسليم مااتسجّلش.');
  }

  // إرسال رسالة التسليم بعد نجاح تحديث حالة الطلب لضمان عدم إدراج رسائل تسليم يتيمة عند فشل التحديث
  // ⚠️ كانت بترمي لو الرسالة فشلت (فالعميل مايتبلّغش)؛ دلوقتي بترجّع نفس
  //    الخطأ لمقدّم الخدمة بنفس الترتيب — من غير إشعار للعميل.
  const sent = await sendServiceOrderMessage(orderId, text, true);
  if (!sent.ok) return sent;

  await notifyUser({
    event: 'order_status',
    recipientProfileId: order.buyer_profile_id,
    title: 'تم تسليم طلبك',
    message: 'راجع ما سلّمه المدرب وأكّد الاستلام.',
    link: `/account/orders/creative-writing/${orderId}`,
  });

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * تسجيل مستحق المدرب عند اكتمال الطلب.
 *
 * ── العطل اللي خلّى ده يبقى دالة في القاعدة ─────────────────
 *
 * كان `INSERT` مباشر في `instructor_payouts` من هنا. والمشكلة إن
 * اللي بيدوس «أكّد الاستلام» هو **العميل** — والجدول ده عليه سياسة
 * كتابة واحدة: `is_super_admin()`.
 *
 * يعني الإدراج كان بيترفض، والكود يرمي، **بعد** ما الطلب بقى
 * `completed`. فالنتيجة:
 *
 *     الطلب مكتمل ✓     ·     المستحق ما اتسجّلش ✗
 *
 * والعميل يشوف رسالة خطأ على عملية تمّت. ولو حاول تاني، الإقفال
 * مشروط بـ`status = 'delivered'` والحالة بقت `completed` — فالمحاولة
 * بترفض والمستحق يضيع بلا طريق رجوع. والمدرب ما يشتكيش، لأنه بيشوف
 * قايمة مستحقاته وبس والصف مش موجود فيها أصلًا.
 *
 * ⚠️ وحتى الإقفال الإداري كان بيقع: السياسة بتطلب **مدير النظام**
 *    لا أي إداري.
 *
 * ⚠️ والتشخيص (ملف 90) أثبت إن الجدول فاضي ومفيش طلب مكتمل ليه
 *    مدرب — يعني العطل **لسه ما ضربش**، وأول طلب كان هيقع فيه.
 *
 * دلوقتي بيمر على `record_service_order_earning` (ملف 91): دالة
 * `SECURITY DEFINER` بتقرا الطلب بنفسها، **بتحسب المبلغ من صف
 * الطلب** لا من المتصفح، وبتستعمل `ON CONFLICT DO NOTHING` على
 * الفهرس الفريد — فإعادة النداء آمنة.
 *
 * والبديل اللي مااتاخدش: فتح سياسة إدراج للعميل. ده كان هيخلّي أي
 * عميل يكتب أي مبلغ لأي مدرب، لأن الصلاحيات بتحمي الصفوف لا الأعمدة
 * (قاعدة «ب») فمفيش سياسة تقدر تقيّد **المبلغ**.
 */
async function recordInstructorEarning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  order: { id: string; instructor_id: string | null }
): Promise<boolean> {
  if (!order.instructor_id) return false;

  const { error } = await supabase.rpc('record_service_order_earning', {
    p_order_id: order.id,
  });

  if (error) {
    // ⚠️ **مش بنرمي هنا.** الطلب اتقفل فعلًا، ورمي استثناء دلوقتي
    //    بيوري العميل خطأ على عملية تمّت — ويمنعه من إعادة المحاولة
    //    لأن الحالة بقت `completed`.
    //
    //    الطرف اللي لازم يعرف هو **الإدارة**، مش العميل. والدالة
    //    idempotent، فإعادة النداء على نفس الطلب بتسجّل الناقص من
    //    غير خطر دفع مرتين.
    console.error('Error recording instructor earning', error);
    await notifyAdmins({
      event: 'payment_review',
      title: 'مستحق مدرب ما اتسجّلش',
      message: `الطلب ${order.id} اتقفل، ومستحق المدرب مااتسجّلش. محتاج مراجعة.`,
      link: `/dashboard/admin/orders/services/${order.id}`,
    });
    return false;
  }

  return true;
}

async function completeOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  order: {
    id: string;
    instructor_id: string | null;
    instructor_earning: number | null;
    amount: number;
    standalone_service_id: string | null;
  }
): Promise<ServiceOrderResult> {
  // (اسم الخدمة كان بيتقرا هنا عشان وصف المستحق. بقى بيتقرا جوّه
  //  `record_service_order_earning` في القاعدة — استعلام أقل من هنا.)

  const { data: completed, error } = await supabase
    .from('service_orders')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('status', 'delivered')
    .select('id');

  if (error) return fail('تعذّر إقفال الطلب');
  if (!completed || completed.length === 0) {
    return fail('الطلب مش موجود أو تغيّرت حالته — الإقفال مروّحش للقاعدة.');
  }

  // اسم الخدمة بقى بيتقرا جوّه الدالة في القاعدة.
  const earningRecorded = await recordInstructorEarning(supabase, order);

  if (order.instructor_id) {
    // ⚠️ **الرسالة بتتغيّر حسب اللي حصل فعلًا.**
    //
    //    كانت ثابتة: «وأُضيفت حصيلتك إلى مستحقاتك» — تتبعت حتى لو
    //    التسجيل فشل. يعني المدرب ياخد تأكيدًا بحصيلة **مش موجودة**،
    //    ويستنى فلوسًا مالهاش صف في القاعدة، ومايشتكيش لأنه مطمّن.
    //
    //    كذبة على المدرب أسوأ من سكوت: السكوت بيخلّيه يسأل.
    await notifyUser({
      event: 'order_status',
      recipientProfileId: await getInstructorUserId(order.instructor_id),
      title: 'اكتمل الطلب',
      message: earningRecorded
        ? 'تم تأكيد الاستلام، وأُضيفت حصيلتك إلى مستحقاتك.'
        : 'تم تأكيد الاستلام. حصيلتك تحت المراجعة — هنبلّغك أول ما تظهر في مستحقاتك.',
      link: '/dashboard/instructor/payouts',
    });
  }

  // ⚠️ فشل تسجيل المستحق **مش** فشل للعملية: الطلب اتقفل فعلًا والإدارة
  //    اتبلّغت (شوف `recordInstructorEarning`).
  return { ok: true };
}

/** العميل يؤكد استلام العمل. */
export async function confirmServiceOrderReceipt(orderId: string): Promise<ServiceOrderResult> {
  const loaded = await loadOrderFor(orderId);
  if (!loaded.ok) return loaded;
  const { supabase, user, order } = loaded;

  if (order.buyer_profile_id !== user.id) {
    return fail('هذا الطلب ليس طلبك');
  }
  if (order.status !== 'delivered') {
    return fail('لم يُسلَّم هذا الطلب بعد');
  }

  const completed = await completeOrder(supabase, order);
  if (!completed.ok) return completed;

  revalidateOrder(orderId);
  return { ok: true };
}

/* ---------------- الإدارة ---------------- */

/**
 * يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال.
 *
 * ⚠️ `requireAdmin` بترمي — فبتتلفّ هنا وترجع نتيجة، وكل دالة لازم تشيك على `ok`.
 */
async function requireOrdersAdmin() {
  try {
    const admin = await requireAdmin('canManageOrders', 'غير مصرح لك بإدارة الطلبات');
    return { ok: true as const, admin };
  } catch (err) {
    return fail(errMessage(err, 'غير مصرح لك بإدارة الطلبات'));
  }
}

/** تأكيد استلام المبلغ. */
export async function confirmServiceOrderPayment(orderId: string): Promise<ServiceOrderResult> {
  const guard = await requireOrdersAdmin();
  if (!guard.ok) return guard;
  const { admin } = guard;
  const supabase = await createClient();

  // المهلة بتبدأ من تأكيد الدفع مش من إنشاء الطلب: قبل الدفع مفيش
  // التزام على مقدّم الخدمة أصلًا.
  const dueAt = new Date(Date.now() + SERVICE_DUE_DAYS * 24 * 60 * 60 * 1000);

  const { data: paid, error } = await supabase
    .from('service_orders')
    .update({ status: 'paid', due_at: dueAt.toISOString() })
    .eq('id', orderId)
    .in('status', ['pending', 'awaiting_verification'])
    .select('id');

  if (error) return fail('تعذّر تأكيد الدفع');
  if (!paid || paid.length === 0) {
    return fail('الطلب مش موجود أو تم تأكيد دفعه مسبقاً — التغيير مروّحش للقاعدة.');
  }

  const { data: order } = await supabase
    .from('service_orders')
    .select('buyer_profile_id, instructor_id, provider_id')
    .eq('id', orderId)
    .maybeSingle();

  if (order) {
    await notifyUser({
      event: 'order_status',
      recipientProfileId: order.buyer_profile_id,
      title: 'تم تأكيد دفعك',
      message: 'استلمنا المبلغ، والمدرب سيبدأ التنفيذ.',
      link: `/account/orders/creative-writing/${orderId}`,
    });
    const providerUserId = order.provider_id
      ? await getProviderUserId(order.provider_id)
      : order.instructor_id
        ? await getInstructorUserId(order.instructor_id)
        : null;
    if (providerUserId) {
      await notifyUser({
        event: 'service_order_new',
        recipientProfileId: providerUserId,
        title: 'طلب جاهز للتنفيذ',
        message: `تم تأكيد الدفع — يمكنك بدء التنفيذ الآن. المهلة ${SERVICE_DUE_DAYS} يومًا.`,
        link: `/dashboard/provider/orders/${orderId}`,
      });
    }
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'service_order_payment_confirmed',
    entityType: 'ServiceOrder',
    entityId: orderId,
  });

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * الإدارة تقفل طلبًا سلّمه المدرب ولم يؤكده العميل.
 *
 * لا يحدث هذا تلقائيًا بمرور الوقت: صمت العميل إشارة على احتمال وجود مشكلة،
 * لا موافقة ضمنية — فيقرأه إنسان ويقرر.
 */
export async function closeServiceOrderByAdmin(
  orderId: string,
  reason: string,
): Promise<ServiceOrderResult> {
  const guard = await requireOrdersAdmin();
  if (!guard.ok) return guard;
  const { admin } = guard;
  const loaded = await loadOrderFor(orderId);
  if (!loaded.ok) return loaded;
  const { supabase, order } = loaded;

  if (order.status !== 'delivered') {
    return fail('هذا الطلب ليس في حالة "تم التسليم"');
  }
  if (!reason.trim()) {
    return fail('اكتب سبب الإقفال', 'reason');
  }

  const completed = await completeOrder(supabase, order);
  if (!completed.ok) return completed;

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'service_order_closed_by_admin',
    entityType: 'ServiceOrder',
    entityId: orderId,
    metadata: { reason: reason.trim() },
  });

  revalidateOrder(orderId);
  return { ok: true };
}

/** استرجاع أو إلغاء — بقرار من الإدارة وبسبب مسجَّل. */
export async function setServiceOrderStatusByAdmin(
  orderId: string,
  status: 'refunded' | 'cancelled',
  reason: string
): Promise<ServiceOrderResult> {
  const guard = await requireOrdersAdmin();
  if (!guard.ok) return guard;
  const { admin } = guard;
  if (!reason.trim()) return fail('اكتب السبب', 'reason');

  const supabase = await createClient();

  const { data: order, error: fetchError } = await supabase
    .from('service_orders')
    .select('id, status, buyer_profile_id')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchError || !order) {
    return fail('الطلب غير موجود');
  }

  if (order.status === 'completed') {
    return fail('لا يمكن إلغاء أو استرجاع طلب مكتمل');
  }
  if (order.status === 'cancelled') {
    return fail('الطلب ملغي بالفعل');
  }
  if (order.status === 'refunded') {
    return fail('تم استرجاع هذا الطلب بالفعل');
  }

  const { data: statusRows, error } = await supabase
    .from('service_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id');

  if (error) return fail('تعذّر تحديث حالة الطلب');
  if (!statusRows || statusRows.length === 0) {
    return fail('الطلب مش موجود أو تغيّرت حالته — التغيير مروّحش للقاعدة.');
  }

  await notifyUser({
    event: 'order_status',
    recipientProfileId: order.buyer_profile_id,
    title: status === 'refunded' ? 'تم استرجاع طلبك' : 'تم إلغاء طلبك',
    message: reason.trim(),
    link: `/account/orders/creative-writing/${orderId}`,
  });

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: status === 'refunded' ? 'service_order_refunded' : 'service_order_cancelled',
    entityType: 'ServiceOrder',
    entityId: orderId,
    metadata: { reason: reason.trim() },
  });

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * تعديل مهلة التسليم لطلب بعينه.
 *
 * المهلة الطبيعية 14 يومًا من تأكيد الدفع. الدالة دي للحالة اللي الطرفين
 * فيها اتفقوا على غير كده — والسبب بيتكتب وبيفضل ظاهر للطرفين، عشان
 * ما يبقاش فيه تمديد من غير ما حد يعرف ليه.
 */
export async function setServiceOrderDueDate(
  orderId: string,
  dueAt: string | null,
  note: string,
): Promise<ServiceOrderResult> {
  const guard = await requireOrdersAdmin();
  if (!guard.ok) return guard;
  const { admin } = guard;

  // الرسائل بترجع بدل ما تترمي: Next بيخفي أي رسالة مرمية في الإنتاج
  // ويستبدلها بنص إنجليزي عام — فاللي بيعدّل المهلة كان بيشوف «حصل خطأ»
  // من غير ما يعرف إن السبب هو إنه ساب خانة السبب فاضية.
  const reason = note.trim();
  if (dueAt && !reason) {
    return fail('اكتب سبب تغيير المهلة — بيظهر للطرفين', 'note');
  }
  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) {
    return fail('التاريخ غير صحيح', 'dueAt');
  }

  const supabase = await createClient();
  const { data: dueRows, error } = await supabase
    .from('service_orders')
    .update({
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      due_note: dueAt ? reason : null,
    })
    .eq('id', orderId)
    .select('id');

  if (error) {
    console.error('Error setting due date', error);
    return { ok: false, error: `تعذّر تعديل المهلة: ${error.message}` };
  }
  if (!dueRows || dueRows.length === 0) {
    return { ok: false, error: 'الطلب مش موجود — المهلة مااتغيّرتش.' };
  }

  // الطرفين يعرفوا. تمديد من غير إخطار بيخلي العميل مستني من غير ما يفهم.
  const { data: order } = await supabase
    .from('service_orders')
    .select('buyer_profile_id, instructor_id, provider_id')
    .eq('id', orderId)
    .maybeSingle();

  if (order) {
    const message = dueAt
      ? `المهلة الجديدة: ${new Date(dueAt).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE })} — ${reason}`
      : 'تم رفع المهلة عن هذا الطلب.';

    await notifyUser({
      event: 'due_date',
      recipientProfileId: order.buyer_profile_id,
      title: 'تعديل مهلة التسليم',
      message,
      link: `/account/orders/creative-writing/${orderId}`,
    });

    const providerUserId = order.provider_id
      ? await getProviderUserId(order.provider_id)
      : order.instructor_id
        ? await getInstructorUserId(order.instructor_id)
        : null;
    if (providerUserId) {
      await notifyUser({
        event: 'due_date',
        recipientProfileId: providerUserId,
        title: 'تعديل مهلة التسليم',
        message,
        link: `/dashboard/provider/orders/${orderId}`,
      });
    }
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'service_order_due_date_changed',
    entityType: 'ServiceOrder',
    entityId: orderId,
  });

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * إثبات دفع طلب خدمة: وسيلة الدفع + صورة الإيصال.
 *
 * الحارس الحقيقي محفّز `guard_service_order_fields`: المشتري مسموح له
 * بانتقال واحد هنا — «بانتظار الدفع» → «بانتظار التأكيد» — والإيصال
 * بيتكتب مرة واحدة معاه.
 */
export async function submitServiceOrderPayment(
  orderId: string,
  payment: { method: 'instapay' | 'vodafone_cash'; receiptUrl: string },
): Promise<ServiceOrderResult> {
  if (!payment.receiptUrl) return { ok: false, error: 'ارفع صورة إيصال التحويل' };
  // مرجع إيصال خاص بتاعنا بس — مش أي رابط من المتصفح (`lib/receipt-ref`).
  if (!isValidReceiptRef(payment.receiptUrl)) {
    return { ok: false, error: 'الإيصال ما اترفعش صح — ارفعه تاني.' };
  }

  const loaded = await loadOrderFor(orderId);
  if (!loaded.ok) return loaded;
  const { supabase, user, order } = loaded;

  if (order.buyer_profile_id !== user.id) {
    return { ok: false, error: 'الطلب غير موجود' };
  }
  if (order.status !== 'pending') {
    return { ok: false, error: 'تم إرسال إثبات الدفع لهذا الطلب بالفعل' };
  }

  const { data: paymentRows, error } = await supabase
    .from('service_orders')
    .update({
      status: 'awaiting_verification',
      payment_method: payment.method,
      payment_receipt_url: payment.receiptUrl,
    })
    .eq('id', orderId)
    .select('id');

  if (error) {
    console.error('Error submitting service order payment', error);
    return { ok: false, error: `تعذّر إرسال الإيصال: ${error.message}` };
  }
  // نفس مصيدة حجز الباقة: رفض صامت من القاعدة كان بيعدّي كأنه نجاح،
  // فالعميل يشوف «اتبعت» ومفيش إيصال وصل للإدارة أصلًا.
  if (!paymentRows || paymentRows.length === 0) {
    return { ok: false, error: 'الإيصال مروّحش للقاعدة — جرّب تاني أو كلّم الدعم.' };
  }

  await notifyAdmins({
    event: 'payment_review',
    title: 'إثبات دفع طلب خدمة بانتظار المراجعة',
    message: 'عميل رفع إيصال تحويل لطلب خدمة إبداعية.',
    link: `/dashboard/admin/orders/services/${orderId}`,
  });

  revalidatePath('/account/orders/creative-writing');
  revalidatePath('/dashboard/admin/orders/services');
  return { ok: true };
}

/**
 * إلغاء المشتري لطلب خدمته المعلّق.
 *
 * نفس الفجوة اللي في الحجوزات: الطلب اللي اتبدأ وما اتدفعش ماكانش
 * ليه مخرج من حساب العميل، ومفيش إلغاء تلقائي بيغطّيه.
 *
 * ⚠️ المعلّق بس — المدفوع أو اللي تحت التنفيذ بيتلغي من الإدارة
 *    (`setServiceOrderStatusByAdmin`) بسبب مسجَّل.
 */
export async function cancelMyServiceOrder(
  orderId: string,
): Promise<ServiceOrderResult> {
  const user = await getCurrentUser();
  if (!user || user.role === 'visitor') return fail('سجّل دخولك الأول');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_my_service_order', { p_id: orderId });

  if (error) {
    console.error('Error cancelling own service order', error);
    if (error.code === 'PGRST202' || error.message?.includes('cancel_my_service_order')) {
      return fail('الإلغاء محتاج ملف القاعدة 20261016110000 يتشغّل الأول');
    }
    return fail('تعذّر إلغاء الطلب. جرّب تاني.');
  }

  const result = data as unknown as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      not_found: 'الطلب غير موجود',
      not_yours: 'الطلب ده مش بتاعك',
      not_cancellable: 'الطلب ده مابينفعش يتلغي — كلّمنا من صفحة الدعم.',
      unauthenticated: 'سجّل دخولك الأول',
      blocked: 'تعذّر إلغاء الطلب. كلّمنا من صفحة الدعم.',
    };
    return fail(messages[result?.error ?? ''] ?? 'تعذّر إلغاء الطلب');
  }

  revalidatePath('/account/orders/creative-writing');
  revalidatePath('/dashboard/admin/orders/services');
  return { ok: true };
}
