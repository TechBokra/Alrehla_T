'use server';
import { requireUser, requireAdmin, requireNotDependent, requireBuyer } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';

import { logAuditAction } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notifications';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';
import { normalizePhone, isValidPhone, PHONE_ERROR } from '@/lib/phone';
import { isItemFormat, type ItemFormat } from '@/lib/item-format';

export type ShippingDetails = {
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  city: string;
  governorate: string;
  notes?: string;
  /** إيميل استلام النسخة الإلكترونية — إلزامي لو فيه إلكتروني (ملف 138). */
  deliveryEmail?: string;
};

/**
 * إنشاء طلب.
 *
 * ⚠️ الواجهة **ما بتبعتش أسعار**. بتبعت إيه اتطلب وكام واحد بس، والقاعدة
 * بتحسب الباقي.
 *
 * ليه كده: قبل التعديل ده كانت الواجهة بتبعت سعر كل صنف والشحن
 * والإجمالي، والخادم بيكتبهم زي ما وصلوا. أي حد يكلّم القاعدة مباشرة
 * (والمفتاح العام موجود في كود المتصفح بطبيعته) كان يقدر يشتري بأي
 * رقم. ومحفّز `guard_order_fields` بيجمّد المبلغ بعد الإنشاء — يعني
 * الرقم الغلط كان بيتقفل عليه ويبان سليم.
 *
 * دلوقتي الطلب كله بيتعمل في دالة واحدة جوه القاعدة
 * (`create_customer_order`): بتجيب السعر من جدول المنتجات، والشحن من
 * جدول المناطق، وبتكتب الطلب وعناصره في عملية واحدة — لو أي خطوة فشلت
 * مفيش حاجة بتتكتب.
 */
export type NewOrderItem = {
  /** رقم المنتج الحقيقي — مش رقم سطر العربة. */
  productId: string;
  quantity: number;
  customizationData?: unknown;
  /** أرقام الإضافات — أسعارها بتتقرا في القاعدة. */
  addonIds?: string[];
  /**
   * الإضافات اللي اتطلبت بتخصيص.
   *
   * القاعدة بتضيف `customization_price` بتاع كل واحدة فيهم، وبترفض
   * الطلب كله لو إضافة هنا مش `supports_customization`.
   */
  customizedAddonIds?: string[];
  /** مطبوعة / إلكترونية / الاتنين — القاعدة بتتحقق وبتسعّر (ملف 138). */
  format?: ItemFormat;
};

export type CreateOrderResult =
  | { ok: true; orderId: string; paymentReference: string; totalAmount: number | null }
  | { ok: false; error: string };

/** وسائل الدفع المتاحة — نفس القيم المسموح بيها في قاعدة البيانات. */
export type PaymentMethod = 'instapay' | 'vodafone_cash';

export async function createOrder(
  items: NewOrderItem[],
  shipping?: ShippingDetails,
): Promise<CreateOrderResult> {
  // حساب الطفل التابع ممنوع من الشراء المباشر — الطلب بيمر على ولي أمره.
  // والحساب الموقوف ممنوع من الشراء الجديد — والمنع الحقيقي محفّز في
  // القاعدة (ملف 118)؛ ده بيدّي الرسالة قبل ما نوصل لهناك.
  try {
    await requireNotDependent('الشراء');
    await requireBuyer();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }

  if (!items.length) return { ok: false, error: 'العربة فاضية' };

  const supabase = await createClient();

  // ⚠️ **`type="tel"` مش بيمنع الحروف** — والرقم ده بيروح لشركة
  //    الشحن. الفحص على الخادم لأن الواجهة مش دليل (قاعدة «ع»).
  if (shipping && !isValidPhone(shipping.recipientPhone)) {
    return { ok: false as const, error: PHONE_ERROR };
  }

  const { data, error } = await supabase.rpc('create_customer_order', {
    p_items: items.map((item) => ({
      product_id: item.productId,
      quantity: Math.max(1, Math.trunc(item.quantity) || 1),
      customization_data: (item.customizationData ?? null) as Json,
      addon_ids: item.addonIds ?? [],
      // القاعدة بتقاطعها مع `addon_ids` — فالتخصيص لإضافة مش مختارة
      // بيتجاهل بدل ما يتحسب.
      customized_addon_ids: item.customizedAddonIds ?? [],
      format: isItemFormat(item.format) ? item.format : 'printed',
    })),
    p_shipping: shipping
      ? {
          recipientName: shipping.recipientName?.trim() ?? '',
          // ⚠️ الرقم ده بيروح لشركة الشحن. حروف فيه = شحنة مش هتتسلّم.
          recipientPhone: normalizePhone(shipping.recipientPhone),
          addressLine: shipping.addressLine?.trim() ?? '',
          city: shipping.city?.trim() ?? '',
          governorate: shipping.governorate?.trim() ?? '',
          notes: shipping.notes?.trim() ?? '',
          deliveryEmail: shipping.deliveryEmail?.trim() ?? '',
        }
      : null,
  });

  if (error || !data) {
    console.error('Error creating order:', error);

    // ⚠️ **حالة واحدة بس بتترجم**: «منتج غير موجود: <رقم>».
    //
    //    الرسالة دي بتطلع لما بند في السلة مش في جدول المنتجات —
    //    وأشهر سبب كان زرّ «أضف للسلة» على **إضافة**: الإضافات في
    //    `addon_products` والدالة بتدوّر في `personalized_products`،
    //    فالطلب **كله** كان بيترفض بالقصص اللي معاه.
    //
    //    الزرّ ده اتشال، لكن الرسالة فضلت: أي سلة قديمة مفتوحة في
    //    متصفح عميل لسه فيها البند ده. و«منتج غير موجود: 3f2a-…»
    //    مش بتقول للعميل يعمل إيه.
    if (error?.message?.includes('منتج غير موجود')) {
      return {
        ok: false,
        error:
          'فيه صنف في سلّتك ما بقاش متاحًا للطلب. احذفه من ملخّص الطلب وجرّب تاني.',
      };
    }

    // باقي رسائل القاعدة بتوصل زي ما هي: «منطقة الشحن مش مسجّلة»
    // أنفع للعميل من «تعذّر إنشاء الطلب».
    return { ok: false, error: error?.message ?? 'تعذّر إنشاء الطلب' };
  }

  const orderId = data as unknown as string;

  // الرقم المرجعي بيتولّد في القاعدة مع الطلب، والعميل محتاجه يكتبه في
  // ملاحظة التحويل — فبنرجّعه معانا بدل ما يدوّر عليه.
  const { data: row } = await supabase
    .from('orders')
    .select('payment_reference, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  return {
    ok: true,
    orderId,
    paymentReference: row?.payment_reference ?? '',
    // ⚠️ **المبلغ اللي العميل بيحوّله لازم يبقى بتاع القاعدة**، مش
    //    حساب الشاشة: السلة كانت بتعرض سعر القصة من غير الإضافات،
    //    فالعميل كان بيتقاله «حوّل X» والطلب بـX + الإضافات.
    totalAmount: row?.total_amount != null ? Number(row.total_amount) : null,
  };
}

/**
 * اشتراك صندوق الرحلة (ملف 140).
 *
 * ⚠️ **كان مستحيل**: المعالج كان بيحط رقم الخطة في السلة كأنه منتج،
 *    و`create_customer_order` بتدوّر في المنتجات ← «منتج غير موجود»
 *    بعد ما العميل يملا كل حاجة (ملف 137 أكّد: صفر خطط ليها منتج).
 *
 * الطلب هنا طلب عادي (نفس الدفع والإيصال والرقم المرجعي)، والقاعدة
 * بتحسب السعر والشحن × الشهور. **والاشتراك نفسه مابيتعملش هنا** —
 * بيتعمل لوحده أول ما الإدارة تأكد الدفع (محفّز في القاعدة).
 */
export async function createBoxSubscriptionOrder(
  planId: string,
  details: unknown,
  shipping: ShippingDetails,
): Promise<CreateOrderResult> {
  try {
    await requireNotDependent('الاشتراك');
    await requireBuyer();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }
  if (!planId) return { ok: false, error: 'اختار خطة الأول' };
  if (!isValidPhone(shipping.recipientPhone)) {
    return { ok: false, error: PHONE_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_box_subscription_order', {
    p_plan_id: planId,
    p_details: (details ?? {}) as Json,
    p_shipping: {
      recipientName: shipping.recipientName?.trim() ?? '',
      recipientPhone: normalizePhone(shipping.recipientPhone),
      addressLine: shipping.addressLine?.trim() ?? '',
      city: shipping.city?.trim() ?? '',
      governorate: shipping.governorate?.trim() ?? '',
      notes: shipping.notes?.trim() ?? '',
    },
  });

  if (error || !data) {
    console.error('Error creating box subscription order:', error);
    // رسائل القاعدة عربي ومفهومة («الخطة دي مش متاحة»، «منطقة الشحن…»).
    return { ok: false, error: error?.message ?? 'تعذّر تسجيل الاشتراك' };
  }

  const orderId = data as unknown as string;
  const { data: row } = await supabase
    .from('orders')
    .select('payment_reference, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  return {
    ok: true,
    orderId,
    paymentReference: row?.payment_reference ?? '',
    totalAmount: row?.total_amount != null ? Number(row.total_amount) : null,
  };
}

/**
 * العميل بيقول «حوّلت» ويرفع الإيصال.
 *
 * كان بيكتب «رقم عملية» بإيده والإدارة بتأكد الدفع من غير ما تشوف أي
 * إثبات. دلوقتي: وسيلة الدفع + صورة الإيصال، والرقم المرجعي بتاعنا
 * بيتولّد مع الطلب ومش بيتكتب من الواجهة أصلًا.
 *
 * التحقق هنا بيدّي رسالة مفهومة؛ الحارس الحقيقي هو محفّز
 * `guard_order_fields`، اللي بيسمح بانتقال واحد بس: قيد الانتظار →
 * بانتظار التأكيد، والإيصال بيتكتب مرة واحدة معاه.
 */
export async function submitPaymentProof(
  orderId: string,
  payment: { method: PaymentMethod; receiptUrl: string },
) {
  // الدفع كله — إنشاء الطلب ورفع الإيصال — بعيد عن حساب الطفل.
  let user;
  try {
    user = await requireNotDependent('تأكيد الدفع');
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }

  if (!payment.receiptUrl) {
    return { success: false, error: 'ارفع صورة إيصال التحويل' };
  }

  const supabase = await createClient();

  // الطلب ده بتاعه أصلًا؟ الصلاحيات بترفض غير كده، بس الرسالة بتبقى أوضح.
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) {
    return { success: false, error: 'الطلب غير موجود' };
  }
  if (order.status !== 'pending') {
    return { success: false, error: 'تم إرسال إثبات الدفع لهذا الطلب بالفعل' };
  }

  // ⚠️ **دي أخطر `UPDATE` في الملف** (قاعدة «و»).
  //
  //    فيه محفّز حماية على `orders` بيسمح بانتقال واحد بس:
  //    `pending → awaiting_verification`. ولو رفض، أو لو الصلاحيات
  //    منعت الصف، `UPDATE` **بينجح ويرجّع صفر صفوف** — والكود كان
  //    بيقول «تم».
  //
  //    يعني العميل يرفع إيصال تحويل حقيقي، والشاشة تقول وصل،
  //    والطلب يفضل `pending` ومحدّش في الإدارة شايفه. **فلوس
  //    اتحوّلت ومفيش أثر.**
  //
  //    والشرط `status = 'pending'` في الاستعلام نفسه بيقفل كمان
  //    سباق الضغطتين: التانية بترجّع صفر صفوف بدل ما تدوس فوق
  //    الأولى.
  const { data: updated, error } = await supabase
    .from('orders')
    .update({
      status: 'awaiting_verification',
      payment_method: payment.method,
      payment_receipt_url: payment.receiptUrl,
    })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id');

  if (!error && (!updated || updated.length === 0)) {
    return {
      success: false,
      error: 'إثبات الدفع مروّحش للطلب. حدّث الصفحة وجرّب تاني، ولو فضلت كلّمنا فورًا.',
    };
  }

  if (error) {
    console.error('Error submitting payment proof:', error);
    return { success: false, error: 'تعذّر إرسال إثبات الدفع' };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'order_payment_proof_submitted',
    entityType: 'Order',
    entityId: orderId,
    metadata: { method: payment.method },
  });

  // الإدارة لازم تعرف إن فيه تحويل مستني مراجعة — من غير كده الطلب
  // بيستنى لحد ما حد يفتح الشاشة بالصدفة.
  await notifyAdmins({
    event: 'payment_review',
    title: 'إثبات دفع جديد بانتظار المراجعة',
    message: 'عميل رفع إيصال تحويل لطلب من المتجر.',
    link: `/dashboard/admin/orders/${orderId}`,
  });

  revalidatePath('/account/orders');
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath('/dashboard/admin/orders');

  return { success: true };
}

export async function confirmOrderPayment(orderId: string) {
  // ⚠️ `requireAdmin` **بترمي**، وNext بيمسح نص الاستثناء في الإنتاج
  //    (قاعدة «هـ»). والزرار ده في شاشة الإدارة، فالإداري اللي مالوش
  //    الصلاحية كان بيدوس ويشوف شاشة خطأ عامة بالإنجليزي.
  let currentUser;
  try {
    currentUser = await requireAdmin(
      'canManageOrders',
      'تأكيد الدفع متاح للإدارة فقط',
    );
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'غير مصرح لك بتأكيد الدفع',
    };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', orderId)
    .eq('status', 'awaiting_verification')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error confirming payment:', error);
    return { success: false, error: 'تعذّر تأكيد الدفع — جرّب تاني.' };
  }

  // ⚠️ قاعدة (و): `UPDATE` على صف مش موجود بينجح **بصفر صفوف وبلا
  //    خطأ**. والدالة دي كانت بترجّع `{ success: true }` على طول —
  //    يعني الإداري يشوف «تم» على **طلب ما اتغيّرش**، ويفتكر إن الفلوس
  //    اتأكدت والطلب داخل التنفيذ.
  //
  //    وشرط `status` اتضاف معاه: الطلب اللي اتأكد خلاص أو اتلغى
  //    مايتأكدش تاني بالغلط.
  if (!updated) {
    return {
      success: false,
      error: 'الطلب مش موجود أو حالته اتغيّرت — حدّث الصفحة وشوفها.',
    };
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: 'order_payment_confirmed',
    entityType: 'Order',
    entityId: orderId,
    metadata: { orderId }
  });

  revalidatePath('/enha-lak/checkout');
  revalidatePath('/account/orders/enha-lak');
  revalidatePath('/dashboard/admin/orders');
  return { success: true };
}
