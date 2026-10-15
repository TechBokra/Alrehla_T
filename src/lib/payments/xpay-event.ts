/**
 * قراءة حدث الويبهوك الجاي من XPay وتحويله لحقول نعرفها.
 *
 * ⚠️ **الجسم ده بيانات من بَرّا، مش مصدر ثقة** — حتى بعد ما نتأكد من
 *    التوقيع. التوقيع بيثبت إن XPay هي اللي بعتت، مش إن المبلغ صح ولا
 *    إن الطلب بتاعنا. فكل حقل بيتقرا بحذر، والمبلغ بيتقارن بإجمالي
 *    الطلب في القاعدة قبل أي تأكيد (دالة `record_gateway_payment`).
 *
 * رقم الطلب بيوصل في `metadata.orderId` — إحنا اللي بنحطه وقت إنشاء
 * جلسة الدفع. من غيره مانعرفش الدفعة دي بتاعة أنهي طلب.
 */

/** الأحداث اللي بنتصرّف بناءً عليها. أي حدث تاني بيتسجّل ويتجاهَل. */
export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
] as const;

export type ParsedEvent = {
  id: string;
  type: string;
  orderId: string | null;
  sessionId: string | null;
  intentId: string | null;
  /** بالقرش زي ما البوابة بتبعته — التحويل للجنيه بيحصل في القاعدة. */
  amountMinor: number | null;
  currency: string | null;
  method: string | null;
  livemode: boolean | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function intOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  // بعض البوابات بتبعت المبلغ كنص.
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

/**
 * وسيلة الدفع ممكن تيجي بأسماء مختلفة حسب الحدث. بنوحّدها، وأي اسم
 * مش معروف بيرجع `null` والقاعدة بتحطّ 'card' كافتراضي.
 */
function normalizeMethod(v: unknown): string | null {
  const raw = str(v)?.toLowerCase();
  if (!raw) return null;
  if (raw.includes('fawry')) return 'fawry';
  if (raw.includes('valu')) return 'valu';
  if (raw.includes('apple')) return 'apple_pay';
  // محافظ إلكترونية: البوابة بتسمّيها بأسماء مختلفة، وكلها بتتسجّل 'wallet'
  // في الطلب (القاعدة بتقبلها) حتى لو مش من وسائل الاختيار عندهم.
  if (raw.includes('wallet') || raw.includes('vodafone') || raw.includes('orange')) return 'wallet';
  if (raw.includes('card') || raw === 'visa' || raw === 'mastercard') return 'card';
  return null;
}

export function parseXpayEvent(raw: unknown): ParsedEvent | null {
  const root = obj(raw);
  if (!root) return null;

  const id = str(root.id);
  const type = str(root.type);
  if (!id || !type) return null;

  // الشكل المتوقع: { id, type, data: { object: {...} } }، ولو الجسم
  // جه مسطّحًا بنقرا من الجذر بدل ما نرجّع null ونضيّع الحدث.
  const data = obj(root.data);
  const object = obj(data?.object) ?? obj(data) ?? root;

  const metadata = obj(object.metadata) ?? obj(root.metadata);
  const orderIdRaw = str(metadata?.orderId) ?? str(metadata?.order_id);
  // ⚠️ لازم يكون UUID حقيقي: بنمرّره لدالة بتاخد uuid، والنص الغريب
  //    بيرمي خطأ في القاعدة بدل ما يترفض بهدوء.
  const orderId = orderIdRaw && UUID.test(orderIdRaw) ? orderIdRaw.toLowerCase() : null;

  const paymentIntent = obj(object.paymentIntent);

  return {
    id,
    type,
    orderId,
    sessionId:
      str(object.id)?.startsWith('cs_') === true
        ? str(object.id)
        : str(object.checkoutSessionId) ?? str(object.sessionId),
    intentId: str(object.paymentIntentId) ?? str(paymentIntent?.id) ?? null,
    amountMinor:
      intOrNull(object.amountTotal) ??
      intOrNull(paymentIntent?.amount) ??
      intOrNull(object.amount),
    currency: str(object.currency)?.toUpperCase() ?? null,
    method:
      normalizeMethod(object.paymentMethodType) ??
      normalizeMethod(paymentIntent?.paymentMethodType) ??
      normalizeMethod(Array.isArray(object.paymentMethodTypes) ? object.paymentMethodTypes[0] : null),
    livemode: typeof object.livemode === 'boolean' ? object.livemode : null,
  };
}

/** هل الحدث ده يستاهل معالجة، ولا نسجّله ونعدّي؟ */
export function isHandledEvent(type: string): boolean {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}
