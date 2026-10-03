'use server';
import { requireAdmin, getDependentGuardian } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { hasAdminPermission, calculateFinalSessionPrice } from '@/lib/utils';
import { notifyUser, notifyAdmins, getInstructorUserId, getProviderUserId } from '@/lib/notifications';
import { SERVICE_DUE_DAYS } from '@/lib/service-delivery';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { briefMessage } from '@/lib/service-details';

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
export async function createServiceOrder(params: {
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
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  // حساب الطفل التابع ممنوع من الطلب المباشر — يمر على ولي أمره.
  const dependent = await getDependentGuardian();
  if (dependent) {
    throw new Error('طلب الخدمة محتاج موافقة ولي أمرك. كلّمه يعمله من حسابه.');
  }

  const { serviceId } = params;
  let providerId = params.providerId ?? null;

  // المشارك: لو فرد من العائلة، لازم يبقى **فعلًا تابع للمشتري**.
  // من غير الفحص ده أي حد يبعت رقم طفل مش بتاعه ويشوف اسمه في الطلب.
  const participantType = params.participantType === 'child' ? 'child' : 'self';
  let childId: string | null = null;

  if (participantType === 'child') {
    if (!params.childId) throw new Error('اختار المستفيد من الخدمة');
    const { data: child } = await supabase
      .from('child_profiles')
      .select('id')
      .eq('id', params.childId)
      .eq('user_profile_id', user.id)
      .maybeSingle();
    if (!child) throw new Error('فرد العائلة ده مش على حسابك');
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

  if (serviceError || !service) throw new Error('الخدمة غير موجودة');

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
      throw new Error('مقدّم الخدمة غير متاح حالياً');
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
      throw new Error('مقدّم الخدمة لا يقدم هذه الخدمة حالياً');
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

      const { data: formula } = await supabase
        .from('pricing_formula_settings')
        .select('platform_multiplier, fixed_admin_fee')
        .eq('id', 'default')
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
      throw new Error('يجب اختيار مقدّم للخدمة');
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
    })
    .select('id, payment_reference')
    .single();

  if (error || !order) {
    console.error('Error creating service order', error);
    throw new Error('تعذّر إنشاء الطلب');
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
    ok: true,
    orderId: order.id,
    amount,
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

async function loadOrderFor(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const { data: order } = await supabase
    .from('service_orders')
    .select('id, buyer_profile_id, instructor_id, status, amount, instructor_earning, standalone_service_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) throw new Error('الطلب غير موجود');
  return { supabase, user, order };
}

async function isAssignedInstructor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  instructorId: string | null,
  userId: string
) {
  if (!instructorId) return false;
  const { data } = await supabase
    .from('instructors')
    .select('id')
    .eq('id', instructorId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
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
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const text = body.trim();
  if (!text) throw new Error('اكتب رسالة أولاً');
  if (text.length > 4000) throw new Error('الرسالة طويلة جدًا');

  const { error } = await supabase.from('service_order_messages').insert({
    order_id: orderId,
    sender_profile_id: user.id,
    body: text,
    is_delivery: isDelivery,
  });

  if (error) {
    console.error('Error sending order message', error);
    throw new Error('تعذّر إرسال الرسالة');
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
export async function startServiceOrder(orderId: string) {
  const { supabase, user, order } = await loadOrderFor(orderId);

  if (!(await isAssignedInstructor(supabase, order.instructor_id, user.id))) {
    throw new Error('هذا الطلب ليس مسنَدًا إليك');
  }
  if (order.status !== 'paid') {
    throw new Error('لا يمكن بدء التنفيذ قبل تأكيد الدفع');
  }

  const { data: started, error } = await supabase
    .from('service_orders')
    .update({ status: 'in_progress' })
    .eq('id', orderId)
    .eq('status', 'paid')
    .select('id');

  if (error) throw new Error('تعذّر تحديث حالة الطلب');
  if (!started || started.length === 0) {
    throw new Error('الطلب مش موجود أو تغيّرت حالته — التغيير مروّحش للقاعدة.');
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
export async function deliverServiceOrder(orderId: string, deliveryMessage: string) {
  const { supabase, user, order } = await loadOrderFor(orderId);

  if (!(await isAssignedInstructor(supabase, order.instructor_id, user.id))) {
    throw new Error('هذا الطلب ليس مسنَدًا إليك');
  }
  if (order.status !== 'in_progress' && order.status !== 'paid') {
    throw new Error('لا يمكن التسليم في هذه الحالة');
  }

  const text = deliveryMessage.trim();
  if (text.length < 10) {
    throw new Error('اكتب رسالة التسليم للعميل (ما الذي سلّمته وأين يجده)');
  }

  const { data: delivered, error } = await supabase
    .from('service_orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', orderId)
    .in('status', ['in_progress', 'paid'])
    .select('id');

  if (error) throw new Error('تعذّر تسجيل التسليم');
  if (!delivered || delivered.length === 0) {
    throw new Error('الطلب مش موجود أو تغيّرت حالته — التسليم مااتسجّلش.');
  }

  // إرسال رسالة التسليم بعد نجاح تحديث حالة الطلب لضمان عدم إدراج رسائل تسليم يتيمة عند فشل التحديث
  await sendServiceOrderMessage(orderId, text, true);

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
) {
  // (اسم الخدمة كان بيتقرا هنا عشان وصف المستحق. بقى بيتقرا جوّه
  //  `record_service_order_earning` في القاعدة — استعلام أقل من هنا.)

  const { data: completed, error } = await supabase
    .from('service_orders')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('status', 'delivered')
    .select('id');

  if (error) throw new Error('تعذّر إقفال الطلب');
  if (!completed || completed.length === 0) {
    throw new Error('الطلب مش موجود أو تغيّرت حالته — الإقفال مروّحش للقاعدة.');
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
}

/** العميل يؤكد استلام العمل. */
export async function confirmServiceOrderReceipt(orderId: string) {
  const { supabase, user, order } = await loadOrderFor(orderId);

  if (order.buyer_profile_id !== user.id) {
    throw new Error('هذا الطلب ليس طلبك');
  }
  if (order.status !== 'delivered') {
    throw new Error('لم يُسلَّم هذا الطلب بعد');
  }

  await completeOrder(supabase, order);

  revalidateOrder(orderId);
  return { ok: true };
}

/* ---------------- الإدارة ---------------- */

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireOrdersAdmin() {
  return requireAdmin('canManageOrders', 'غير مصرح لك بإدارة الطلبات');
}

/** تأكيد استلام المبلغ. */
export async function confirmServiceOrderPayment(orderId: string) {
  const admin = await requireOrdersAdmin();
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

  if (error) throw new Error('تعذّر تأكيد الدفع');
  if (!paid || paid.length === 0) {
    throw new Error('الطلب مش موجود أو تم تأكيد دفعه مسبقاً — التغيير مروّحش للقاعدة.');
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
export async function closeServiceOrderByAdmin(orderId: string, reason: string) {
  const admin = await requireOrdersAdmin();
  const { supabase, order } = await loadOrderFor(orderId);

  if (order.status !== 'delivered') {
    throw new Error('هذا الطلب ليس في حالة "تم التسليم"');
  }
  if (!reason.trim()) {
    throw new Error('اكتب سبب الإقفال');
  }

  await completeOrder(supabase, order);

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
) {
  const admin = await requireOrdersAdmin();
  if (!reason.trim()) throw new Error('اكتب السبب');

  const supabase = await createClient();

  const { data: order, error: fetchError } = await supabase
    .from('service_orders')
    .select('id, status, buyer_profile_id')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchError || !order) {
    throw new Error('الطلب غير موجود');
  }

  if (order.status === 'completed') {
    throw new Error('لا يمكن إلغاء أو استرجاع طلب مكتمل');
  }
  if (order.status === 'cancelled') {
    throw new Error('الطلب ملغي بالفعل');
  }
  if (order.status === 'refunded') {
    throw new Error('تم استرجاع هذا الطلب بالفعل');
  }

  const { data: statusRows, error } = await supabase
    .from('service_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id');

  if (error) throw new Error('تعذّر تحديث حالة الطلب');
  if (!statusRows || statusRows.length === 0) {
    throw new Error('الطلب مش موجود أو تغيّرت حالته — التغيير مروّحش للقاعدة.');
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireOrdersAdmin();

  // الرسائل بترجع بدل ما تترمي: Next بيخفي أي رسالة مرمية في الإنتاج
  // ويستبدلها بنص إنجليزي عام — فاللي بيعدّل المهلة كان بيشوف «حصل خطأ»
  // من غير ما يعرف إن السبب هو إنه ساب خانة السبب فاضية.
  const reason = note.trim();
  if (dueAt && !reason) {
    return { ok: false, error: 'اكتب سبب تغيير المهلة — بيظهر للطرفين' };
  }
  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) {
    return { ok: false, error: 'التاريخ غير صحيح' };
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!payment.receiptUrl) return { ok: false, error: 'ارفع صورة إيصال التحويل' };

  const { supabase, user, order } = await loadOrderFor(orderId);

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
