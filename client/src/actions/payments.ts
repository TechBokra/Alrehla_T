'use server';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { createCheckoutSession, isXpayConfigured } from '@/lib/payments/xpay-client';
import { getPaymentSettings } from '@/data/domains/(shared)/payments/queries';
import {
  PAYMENT_METHODS,
  parsePaymentSettings,
  validatePaymentSettings,
  type GatewayMethod,
  type PaymentProvider,
  type PaymentSettings,
} from '@/lib/payments/settings';
import type { PaymentKind } from '@/lib/payments/xpay-event';
import { SITE_URL } from '@/lib/seo';

/**
 * بدء دفعة بالبوابة، وإعدادات الدفع في اللوحة.
 *
 * ⚠️ كل الدوال بترجّع `{ok}` ومابترميش — Next بيمسح نصّ الاستثناء في
 *    الإنتاج، فالعميل كان هيشوف «خطأ غير متوقع» بدل السبب.
 */

export type StartPaymentResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const PAY_FAILED = 'تعذّر فتح صفحة الدفع. جرّب تاني، أو ادفع بالتحويل.';

/**
 * بينشئ جلسة دفع للطلب وبيرجّع رابط البوابة.
 *
 * ⚠️ **المبلغ بيتقرا من القاعدة، مش من المتصفح.** لو خدناه من الواجهة،
 *    أي حد يقدر يعدّله ويدفع ١ جنيه بدل ٥٠٠.
 */
export async function startGatewayPayment(
  orderId: string,
  kind: PaymentKind = 'order',
): Promise<StartPaymentResult> {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { ok: false, error: 'سجّل دخولك الأول' };

  const settings = await getPaymentSettings();
  if (settings.provider !== 'xpay' || !isXpayConfigured()) {
    return { ok: false, error: 'الدفع بالبطاقة غير متاح حاليًا — ادفع بالتحويل.' };
  }

  // خدمة كتابة أو حجز باقة — جدول تاني ودوال تانية.
  if (kind !== 'order') {
    return startCreativeWritingPayment(orderId, kind, settings.methods);
  }

  // RLS بتضمن إن العميل يقرا طلبه هو بس.
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, total_amount, status, payment_reference, delivery_email, recipient_name, recipient_phone')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    console.error('تعذّر قراءة الطلب قبل الدفع', error);
    return { ok: false, error: PAY_FAILED };
  }
  if (!order) return { ok: false, error: 'الطلب غير موجود' };
  if (order.status !== 'pending' && order.status !== 'failed') {
    return { ok: false, error: 'الطلب ده مش في انتظار الدفع' };
  }

  const session = await createCheckoutSession({
    orderId: order.id,
    kind: 'order',
    amount: order.total_amount,
    description: `طلب رقم ${order.payment_reference ?? order.id.slice(0, 8)}`,
    methods: settings.methods,
    successUrl: `${SITE_URL}/enha-lak/order-confirmation?id=${order.id}`,
    cancelUrl: `${SITE_URL}/account/orders/enha-lak/${order.id}/pay`,
    customer: {
      name: order.recipient_name ?? undefined,
      email: order.delivery_email ?? undefined,
      phone: order.recipient_phone ?? undefined,
    },
  });

  // الجلسة اتفتحت لكن فيه إعداد غلط — بيتسجّل للإدارة والعميل بيكمّل دفع.
  if (session.ok && session.note) {
    await recordSessionFailure(order.id, session.note);
  }

  if (!session.ok) {
    // ⚠️ سبب الرفض الحقيقي بيتسجّل في `payment_events` (يقراه الأدمن بس).
    //    من غير كده الوحيد اللي بيعرف السبب هو سجل الخادم، واللي مش
    //    متاح لكل خطة — فالعطل بيفضل مجهول.
    await recordSessionFailure(order.id, session.detail ?? 'unknown');
    return { ok: false, error: session.error };
  }

  // ربط الجلسة بالطلب — الدالة بتتأكد إن الطلب بتاع العميل ده.
  const { data: attached, error: attachError } = await supabase.rpc('attach_payment_session', {
    p_order_id: order.id,
    p_session_id: session.sessionId,
  });

  if (attachError || !(attached as { ok?: boolean } | null)?.ok) {
    console.error('تعذّر ربط جلسة الدفع بالطلب', attachError ?? attached);
    return { ok: false, error: PAY_FAILED };
  }

  return { ok: true, url: session.url };
}

/**
 * يسجّل فشل إنشاء جلسة دفع عشان الإدارة تشوف السبب.
 *
 * بيستخدم مفتاح الخدمة لأن الكتابة في `payment_events` مقفولة على
 * الجميع عن قصد. فشل التسجيل نفسه مابيوقّفش حاجة — العميل شاف رسالته
 * خلاص، ومفيش داعي نوقعه مرتين.
 */
async function recordSessionFailure(
  orderId: string,
  detail: string,
  kind: PaymentKind = 'order',
): Promise<void> {
  if (!isAdminApiConfigured()) return;
  try {
    const admin = createAdminClient();
    await admin.from('payment_events').insert({
      id: `local_fail_${orderId}_${Date.now()}`,
      event_type: 'checkout.session.create_failed',
      // ⚠️ `order_id` عليه مفتاح أجنبي على `orders` وحده — فرقم خدمة
      //    أو حجز بيترفض. دول بيتكتبوا في `source_id` بدل كده.
      order_id: kind === 'order' ? orderId : null,
      source_kind: kind,
      source_id: orderId,
      outcome: 'session_create_failed',
      payload: { detail: detail.slice(0, 1000) } as never,
    });
  } catch (error) {
    console.error('تعذّر تسجيل فشل جلسة الدفع', error);
  }
}

/* ──────────────── دفع خدمات وحجوزات «بداية الرحلة» ──────────────── */

/** صفحة العميل اللي بيرجع لها بعد الدفع، لكل نوع. */
const CW_RETURN: Record<'service_order' | 'course_subscription', (id: string) => string> = {
  service_order: (id) => `/account/orders/creative-writing/${id}`,
  course_subscription: () => '/account/bookings',
};

/**
 * دفعة بالبوابة لخدمة كتابة أو حجز باقة.
 *
 * ⚠️ **جدول تاني وقواعد تانية**: مفيش حالة `failed` هنا، فالمحاولة
 *    الفاشلة بتسيب الصف `pending` والعميل يقدر يعيد. والمبلغ بيتقرا من
 *    القاعدة زي الطلبات بالظبط — مش من المتصفح.
 */
async function startCreativeWritingPayment(
  id: string,
  kind: 'service_order' | 'course_subscription',
  methods: GatewayMethod[],
): Promise<StartPaymentResult> {
  const supabase = await createClient();

  // RLS بتقصر القراءة على صفوف العميل نفسه.
  //
  // ⚠️ الفرعين بيتقروا في متغيّرات بسيطة مش في اتحاد من ردّين — اتحاد
  //    `PostgrestSingleResponse` لجدولين مختلفين بيضيّع التضييق.
  let amountRaw: number | null = null;
  let status = '';
  let reference: string | null = null;
  let found = false;
  let readFailed = false;

  if (kind === 'service_order') {
    const { data, error } = await supabase
      .from('service_orders')
      .select('amount, status, payment_reference')
      .eq('id', id)
      .maybeSingle();
    if (error) readFailed = true;
    else if (data) {
      found = true;
      amountRaw = data.amount;
      status = data.status;
      reference = data.payment_reference;
    }
  } else {
    const { data, error } = await supabase
      .from('course_subscriptions')
      .select('amount, status, payment_reference')
      .eq('id', id)
      .maybeSingle();
    if (error) readFailed = true;
    else if (data) {
      found = true;
      amountRaw = data.amount;
      status = data.status;
      reference = data.payment_reference;
    }
  }

  if (readFailed) return { ok: false, error: PAY_FAILED };
  if (!found) return { ok: false, error: 'الطلب غير موجود' };
  if (status !== 'pending') {
    return { ok: false, error: 'الطلب ده مش في انتظار الدفع' };
  }

  const amount = Number(amountRaw ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'مبلغ الطلب غير محدد — كلّمنا من صفحة الدعم.' };
  }

  const label = kind === 'service_order' ? 'خدمة' : 'حجز';
  const session = await createCheckoutSession({
    orderId: id,
    kind,
    amount,
    description: `${label} رقم ${reference ?? id.slice(0, 8)}`,
    methods,
    successUrl: `${SITE_URL}${CW_RETURN[kind](id)}`,
    cancelUrl: `${SITE_URL}${CW_RETURN[kind](id)}`,
  });

  if (session.ok && session.note) await recordSessionFailure(id, session.note, kind);

  if (!session.ok) {
    await recordSessionFailure(id, session.detail ?? 'unknown', kind);
    return { ok: false, error: session.error };
  }

  const { data: attached, error: attachError } = await supabase.rpc('attach_payment_session_cw', {
    p_kind: kind,
    p_id: id,
    p_session_id: session.sessionId,
  });

  // ⚠️ الدالة بتتأكد إن رقم الجلسة اتخزن فعلًا وبترجّع `blocked` لو لأ —
  //    نجاح كاذب هنا معناه دفعة مالهاش أثر نتتبعه.
  if (attachError || !(attached as { ok?: boolean } | null)?.ok) {
    console.error('تعذّر ربط جلسة الدفع', attachError ?? attached);
    return { ok: false, error: PAY_FAILED };
  }

  return { ok: true, url: session.url };
}

/* ───────────────────────── إعدادات اللوحة ───────────────────────── */

export type SettingsResult = { ok: true } | { ok: false; error: string; field?: string };

const DENIED = 'غير مصرح لك بإدارة إعدادات الدفع';

async function requirePaymentsAdmin() {
  try {
    // ⚠️ صلاحية مستقلة عن «الطلبات» و«المحتوى»: الصفحة دي فيها رقم
    //    المحفظة اللي بتستقبل فلوس العملاء ومفتاح فتح البوابة.
    return await requireAdmin('canManagePayments', DENIED);
  } catch {
    return null;
  }
}

/**
 * الطلب ده لسه مستني دفع؟ — لاستكمال طلب اتسجّل ومااتدفعش (قرار ٢٤
 * أكتوبر). بجلسة العميل: صلاحيات `orders` بتوري طلباته هو بس.
 *
 * ⚠️ مابترميش. أي فشل = «مش متاح للاستكمال»، والعميل يعمل طلب جديد.
 */
export async function getResumableOrder(
  orderId: string,
): Promise<{ ok: true; reference: string; total: number } | { ok: false }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('orders')
      .select('id, status, total_amount, payment_reference')
      .eq('id', orderId)
      .maybeSingle();
    if (!data || (data.status !== 'pending' && data.status !== 'failed')) return { ok: false };
    return {
      ok: true,
      reference: data.payment_reference ?? data.id.slice(0, 8),
      total: Number(data.total_amount),
    };
  } catch {
    return { ok: false };
  }
}

/**
 * الطلب ده العميل خلّصه ولا لأ؟ — لتفضية السلة بعد الدفع.
 *
 *   placed  اتدفع أو مستني مراجعة إيصال أو بعده → بنوده تتشال من السلة
 *   unpaid  لسه مستني دفع → السلة زي ما هي (وينفع يكمّله)
 *   closed  اتلغى أو اترجع → السلة زي ما هي، والطلب المحفوظ يتنسي
 *   unknown مانعرفش (شبكة/مش طلبه) → مانعملش حاجة
 */
export async function getOrderPaymentState(
  orderId: string,
): Promise<'placed' | 'unpaid' | 'closed' | 'unknown'> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
    if (!data) return 'unknown';
    if (data.status === 'pending' || data.status === 'failed') return 'unpaid';
    if (data.status === 'cancelled' || data.status === 'refunded') return 'closed';
    return 'placed';
  } catch {
    return 'unknown';
  }
}

export async function savePaymentSettings(input: {
  provider: string;
  methods: string[];
  feesPassThrough: boolean;
  gatewayDownMessage: string;
}): Promise<SettingsResult> {
  const admin = await requirePaymentsAdmin();
  if (!admin) return { ok: false, error: DENIED };

  const provider: PaymentProvider = input.provider === 'xpay' ? 'xpay' : 'manual';
  const methods = input.methods.filter((m): m is GatewayMethod =>
    (PAYMENT_METHODS as readonly string[]).includes(m),
  );

  const settings: PaymentSettings = {
    provider,
    methods,
    feesPassThrough: input.feesPassThrough === true,
    gatewayDownMessage: (input.gatewayDownMessage ?? '').trim(),
  };

  const problem = validatePaymentSettings(settings);
  if (problem) return { ok: false, error: problem.error, field: problem.field };

  // ⚠️ تفعيل البوابة بدون مفاتيح على الخادم = كل عميل هيقابله خطأ.
  if (settings.provider === 'xpay' && !isXpayConfigured()) {
    return {
      ok: false,
      error:
        'مفاتيح XPay مش موجودة على الخادم. ضيف XPAY_SECRET_KEY و XPAY_WEBHOOK_SECRET في إعدادات Vercel، وأعد النشر، وبعدين فعّل البوابة.',
      field: 'provider',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('site_settings')
    .upsert({ key: 'payments', value: settings }, { onConflict: 'key' })
    .select('key');

  if (error || !data || data.length === 0) {
    console.error('تعذّر حفظ إعدادات الدفع', error);
    return { ok: false, error: 'تعذّر حفظ الإعدادات' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'payment_settings_updated',
    entityType: 'SiteSettings',
    entityId: 'payments',
    metadata: { provider: settings.provider, methods: settings.methods },
  });

  // صفحات المنتجات بتعرض طرق الدفع (٢٤ أكتوبر) — لازم تتجدّد معاها.
  refreshPublicPages();
  revalidatePath('/dashboard/admin/settings/pricing');
  return { ok: true };
}

/**
 * بيانات استقبال التحويلات (رقم المحفظة وكود QR).
 *
 * ⚠️ كانت في «المحتوى وإعدادات الموقع»، يعني أي مسؤول محتوى يقدر يغيّر
 *    الرقم اللي بتتحوّل عليه فلوس العملاء. اتنقلت هنا بصلاحيتها الخاصة.
 */
export async function saveTransferDetails(input: {
  walletNumber: string;
  qrUrl: string | null;
}): Promise<SettingsResult> {
  const admin = await requirePaymentsAdmin();
  if (!admin) return { ok: false, error: DENIED };

  const walletNumber = (input.walletNumber ?? '').trim();
  // ⚠️ الرقم الفاضي بيرجّع الافتراضي المكتوب في الكود — وده أخطر من
  //    إنه يفضل زي ما هو. فبنرفضه.
  if (!walletNumber) {
    return { ok: false, error: 'اكتب رقم المحفظة', field: 'walletNumber' };
  }
  if (!/^[0-9+\s-]{8,20}$/.test(walletNumber)) {
    return { ok: false, error: 'رقم المحفظة غير صحيح', field: 'walletNumber' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'general')
    .maybeSingle();

  const current = (existing?.value ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current, paymentWalletNumber: walletNumber };
  const qr = (input.qrUrl ?? '').trim();
  if (qr) next.paymentQrUrl = qr;
  else delete next.paymentQrUrl;

  const { data, error } = await supabase
    .from('site_settings')
    .upsert({ key: 'general', value: next as never }, { onConflict: 'key' })
    .select('key');

  if (error || !data || data.length === 0) {
    console.error('تعذّر حفظ بيانات التحويل', error);
    return { ok: false, error: 'تعذّر حفظ بيانات التحويل' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'transfer_details_updated',
    entityType: 'SiteSettings',
    entityId: 'general',
    // ⚠️ الرقم نفسه مابيتسجّلش كامل في السجل.
    metadata: { walletTail: walletNumber.slice(-4), hasQr: !!qr },
  });

  revalidatePath('/dashboard/admin/settings/pricing');
  refreshPublicPages();
  return { ok: true };
}

/** قراءة الإعدادات للوحة (مع حالة المفاتيح على الخادم). */
export async function readPaymentSettingsForAdmin(): Promise<
  | {
      ok: true;
      settings: PaymentSettings;
      gatewayConfigured: boolean;
      walletNumber: string;
      qrUrl: string;
    }
  | { ok: false; error: string }
> {
  const admin = await requirePaymentsAdmin();
  if (!admin) return { ok: false, error: DENIED };

  const supabase = await createClient();
  const [paymentsRes, generalRes] = await Promise.all([
    supabase.from('site_settings').select('value').eq('key', 'payments').maybeSingle(),
    supabase.from('site_settings').select('value').eq('key', 'general').maybeSingle(),
  ]);

  if (paymentsRes.error || generalRes.error) {
    console.error('تعذّر قراءة إعدادات الدفع', paymentsRes.error ?? generalRes.error);
    return { ok: false, error: 'تعذّر قراءة إعدادات الدفع' };
  }

  const general = (generalRes.data?.value ?? {}) as Record<string, unknown>;

  return {
    ok: true,
    settings: parsePaymentSettings(paymentsRes.data?.value),
    gatewayConfigured: isXpayConfigured(),
    walletNumber: typeof general.paymentWalletNumber === 'string' ? general.paymentWalletNumber : '',
    qrUrl: typeof general.paymentQrUrl === 'string' ? general.paymentQrUrl : '',
  };
}
