'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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
export async function startGatewayPayment(orderId: string): Promise<StartPaymentResult> {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { ok: false, error: 'سجّل دخولك الأول' };

  const settings = await getPaymentSettings();
  if (settings.provider !== 'xpay' || !isXpayConfigured()) {
    return { ok: false, error: 'الدفع بالبطاقة غير متاح حاليًا — ادفع بالتحويل.' };
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
    amount: order.total_amount,
    description: `طلب رقم ${order.payment_reference ?? order.id.slice(0, 8)}`,
    methods: settings.methods,
    feesPassThrough: settings.feesPassThrough,
    successUrl: `${SITE_URL}/enha-lak/order-confirmation?id=${order.id}`,
    cancelUrl: `${SITE_URL}/account/orders/enha-lak/${order.id}/pay`,
    customer: {
      name: order.recipient_name ?? undefined,
      email: order.delivery_email ?? undefined,
      phone: order.recipient_phone ?? undefined,
    },
  });

  if (!session.ok) return { ok: false, error: session.error };

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

/* ───────────────────────── إعدادات اللوحة ───────────────────────── */

export type SettingsResult = { ok: true } | { ok: false; error: string; field?: string };

const DENIED = 'غير مصرح لك بإدارة إعدادات الدفع';

async function requirePaymentsAdmin() {
  try {
    // نفس صلاحية الطلبات: اللي بيدير الطلبات هو اللي بيدير الدفع.
    return await requireAdmin('canManageOrders', DENIED);
  } catch {
    return null;
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

  revalidatePath('/dashboard/admin/settings/payments');
  return { ok: true };
}

/** قراءة الإعدادات للوحة (مع حالة المفاتيح على الخادم). */
export async function readPaymentSettingsForAdmin(): Promise<
  { ok: true; settings: PaymentSettings; gatewayConfigured: boolean } | { ok: false; error: string }
> {
  const admin = await requirePaymentsAdmin();
  if (!admin) return { ok: false, error: DENIED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'payments')
    .maybeSingle();

  if (error) {
    console.error('تعذّر قراءة إعدادات الدفع', error);
    return { ok: false, error: 'تعذّر قراءة إعدادات الدفع' };
  }

  return {
    ok: true,
    settings: parsePaymentSettings(data?.value),
    gatewayConfigured: isXpayConfigured(),
  };
}
