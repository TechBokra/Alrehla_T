import 'server-only';
import type { GatewayMethod } from './settings';
import type { PaymentKind } from './xpay-event';

/**
 * الاتصال بـ XPay لإنشاء جلسة دفع.
 *
 * ⚠️ **المفتاح السري يفضل على الخادم.** الملف ده `server-only`، يعني لو
 *    حد استورده في مكوّن متصفح بالغلط، البناء بيفشل بدل ما المفتاح
 *    يتسرّب لصفحة عامة.
 *
 * ⚠️ **ما بنثقش في الرد.** لو البوابة رجّعت حاجة مش متوقعة (رابط ناقص،
 *    رقم جلسة فاضي)، بنرجّع فشل صريح بدل ما نحوّل العميل لصفحة مكسورة.
 */

const API_BASE = 'https://api.xpay.app';
/** الجلسة بتنتهي بعدها — ساعة كفاية لإتمام دفعة، وبتحرّر الطلب بسرعة لو اتساب. */
const SESSION_MINUTES = 60;
const TIMEOUT_MS = 15_000;

export type XpayConfig = { secretKey: string; webhookSecret: string };

/** المفاتيح من متغيرات البيئة — مش من القاعدة أبدًا. */
export function readXpayConfig(): XpayConfig | null {
  const secretKey = process.env.XPAY_SECRET_KEY?.trim();
  const webhookSecret = process.env.XPAY_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) return null;
  return { secretKey, webhookSecret };
}

/** هل البوابة مضبوطة على الخادم؟ (بتتسأل قبل عرض زرار الدفع للعميل.) */
export function isXpayConfigured(): boolean {
  return readXpayConfig() !== null;
}

export type CheckoutSessionInput = {
  orderId: string;
  /**
   * لأي جدول تخصّ الدفعة — بيترجع في بيانات الحدث، وهو اللي بيقول
   * للويبهوك ينادي أنهي دالة. غيابه معناه طلب منتج (`order`).
   */
  kind?: PaymentKind;
  /** بالجنيه المصري الصحيح — بيتحوّل للقرش هنا. */
  amount: number;
  description: string;
  methods: GatewayMethod[];
  successUrl: string;
  cancelUrl: string;
  customer?: { name?: string; email?: string; phone?: string };
};

export type CheckoutSessionResult =
  /** `note` تحذير إداري: الجلسة اتفتحت لكن فيه إعداد محتاج تصحيح. */
  | { ok: true; sessionId: string; url: string; note?: string }
  /**
   * `detail` نصّ تشخيصي **للإدارة بس** (حالة HTTP وردّ البوابة). العميل
   * بيشوف `error` وبس. بيتسجّل في `payment_events` عشان نعرف سبب الرفض
   * من غير ما نحتاج سجلات الخادم.
   */
  | { ok: false; error: string; detail?: string };

const GENERIC_ERROR = 'تعذّر فتح صفحة الدفع. جرّب تاني، أو ادفع بالتحويل.';

export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  const config = readXpayConfig();
  if (!config) return { ok: false, error: GENERIC_ERROR };

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    console.error('xpay: مبلغ غير صالح', input.amount);
    return { ok: false, error: GENERIC_ERROR, detail: `bad amount ${input.amount}` };
  }

  const body = {
    mode: 'payment',
    uiMode: 'hosted',
    currency: 'EGP',
    locale: 'ar',
    submitType: 'PAY',
    expiresAfterMinutes: SESSION_MINUTES,
    // ⚠️ الشكل ده مش تخمين: `{ name, unitAmount }` المسطّح اترفض بـ
    //    `parameter_unknown: lineItems[0][name]`. السعر جوّه `priceData`
    //    واسم المنتج جوّه `productData` — من مثال التوثيق الرسمي.
    lineItems: [
      {
        priceData: {
          currency: 'EGP',
          // ⚠️ بالقرش: الدالة في القاعدة بتقارن بـ`total_amount * 100`،
          //    فأي تغيير هنا لازم يتغيّر هناك.
          unitAmount: input.amount * 100,
          productData: { name: input.description },
        },
        quantity: 1,
      },
    ],
    paymentMethodTypes: input.methods,
    // ⚠️ **`feeConfig` مابيتبعتش عن قصد.** البوابة بترفض الكائن الناقص
    //    (`vatCollectionEnabled` مطلوب جوّاه)، وتحديد تحصيل الضريبة من هنا
    //    قرار مالي مش مكانه كود. من غيره بتسري إعدادات حسابك في XPay:
    //    لوحة XPay ← الإعدادات ← الرسوم والضريبة.
    afterCompletion: { type: 'redirect', redirect: { url: input.successUrl } },
    cancelUrl: input.cancelUrl,
    // ⚠️ ده اللي بيربط الدفعة بالطلب. الويبهوك بيقراه، ومن غيره
    //    مانعرفش الدفعة دي بتاعة مين.
    // ⚠️ `kind` بيرجع لنا من البوابة مع الحدث — من غيره الويبهوك
    //    مايعرفش الدفعة بتاعة طلب ولا خدمة ولا حجز، وبيدوّر على رقم
    //    خدمة في جدول الطلبات ومايلاقيهوش.
    metadata: { orderId: input.orderId, kind: input.kind ?? 'order' },
    customerDetails: input.customer?.email
      ? { email: input.customer.email, name: input.customer.name, phone: input.customer.phone }
      : undefined,
  };

  const send = async (payload: Record<string, unknown>) =>
    fetch(`${API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

  let response: Response;
  try {
    response = await send(body);
  } catch (error) {
    // ⚠️ مابنطبعش `body` ولا الترويسات: فيهم المفتاح السري.
    console.error('xpay: تعذّر الاتصال بالبوابة', error);
    return {
      ok: false,
      error: GENERIC_ERROR,
      detail: `network — ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }

  let fallbackNote = '';
  if (!response.ok) {
    const firstError = await response.text().catch(() => '');

    /**
     * ⚠️ **وسيلة دفع مختارة عندنا ومش مفعّلة في حساب XPay.**
     *
     * ده خطأ إعداد، مش عطل — ومش من حق خطأ إعداد إنه يمنع عميل من
     * الدفع. بنعيد المحاولة من غير ما نحدّد الوسائل، فالبوابة بتعرض
     * الوسائل المفعّلة في الحساب فعلًا. السبب بيتسجّل عشان الإدارة
     * تصلّح الاختيار.
     */
    if (response.status === 400 && firstError.includes('not enabled for this merchant')) {
      console.warn('xpay: وسيلة دفع مش مفعّلة في الحساب — إعادة المحاولة بالإعداد الافتراضي');
      const { paymentMethodTypes: _unused, ...withoutMethods } = body;
      try {
        response = await send(withoutMethods);
      } catch (error) {
        return {
          ok: false,
          error: GENERIC_ERROR,
          detail: `network on retry — ${error instanceof Error ? error.message : 'unknown'}`,
        };
      }
      fallbackNote = `تم تجاهل وسائل الدفع المختارة لأنها غير مفعّلة في حساب XPay. ${firstError.slice(0, 400)}`;
    }

    if (!response.ok) {
      const body2 = await response.text().catch(() => '');
      console.error('xpay: البوابة رفضت إنشاء الجلسة', response.status, body2.slice(0, 500));
      return {
        ok: false,
        error: GENERIC_ERROR,
        detail: `HTTP ${response.status} — ${(body2 || firstError).slice(0, 900)}`,
      };
    }
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const sessionId = typeof payload?.id === 'string' ? payload.id : '';
  const url = typeof payload?.url === 'string' ? payload.url : '';

  if (!sessionId || !url.startsWith('https://')) {
    console.error('xpay: رد غير متوقع من البوابة', { hasId: !!sessionId, hasUrl: !!url });
    return {
      ok: false,
      error: GENERIC_ERROR,
      detail: `unexpected response — ${JSON.stringify(payload).slice(0, 900)}`,
    };
  }

  return { ok: true, sessionId, url, note: fallbackNote || undefined };
}
