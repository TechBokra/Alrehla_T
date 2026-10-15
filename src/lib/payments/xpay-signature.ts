import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * التحقق من توقيع ويبهوك XPay.
 *
 * ── ليه ده أهم ملف في الربط ─────────────────────────────────
 *
 * الويبهوك هو **المصدر الوحيد** اللي بنصدّق منه إن الطلب اتدفع. رجوع
 * العميل للموقع بعد الدفع **مش دليل**: الرابط ده أي حد يقدر يفتحه
 * بنفسه من غير ما يدفع مليم. فلو خلّينا الرجوع هو اللي بيأكّد الدفع،
 * أي زائر يقدر ياخد المنتج ببلاش.
 *
 * وعشان الويبهوك نفسه مجرد طلب HTTP على رابط عام، أي حد يقدر يبعت
 * عليه. التوقيع هو اللي بيثبت إن اللي باعت XPay فعلًا.
 *
 * ── إزاي ──────────────────────────────────────────────────
 *
 * XPay بتبعت ترويسة `XPay-Signature` شكلها: `t=<ثواني>,v1=<hex>`
 * و`v1` = HMAC-SHA256 للنص `${t}.${الجسم الخام}` بمفتاح `whsec_...`.
 *
 * ⚠️ **الجسم الخام حرفيًّا.** لو عملنا `JSON.parse` وبعدين
 *    `JSON.stringify` تاني، ترتيب المفاتيح والمسافات بيتغيّروا
 *    والتوقيع بيفشل وإحنا مش غلطانين. عشان كده الدالة دي بتاخد
 *    نص الجسم زي ما وصل بالظبط.
 *
 * ⚠️ **المقارنة بزمن ثابت** (`timingSafeEqual`). المقارنة العادية
 *    بـ`===` بتقف عند أول حرف مختلف، والفرق في الوقت بيسرّب
 *    التوقيع الصح حرفًا حرفًا لو حد حاول كفاية.
 *
 * ⚠️ **نافذة زمنية ٥ دقايق.** من غيرها، لو حد سجّل طلب ويبهوك صحيح
 *    مرة واحدة (من سجلّ، من وكيل، من أي تسريب) يقدر يعيد إرساله بعد
 *    شهور وهيعدّي.
 */

/** ثواني مسموح بيها بين توقيت التوقيع ووقت الاستلام. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureFailure =
  | 'missing_header'
  | 'malformed_header'
  | 'stale_timestamp'
  | 'bad_signature'
  | 'missing_secret';

export type SignatureResult =
  | { ok: true }
  | { ok: false; reason: SignatureFailure };

/** `t=1700000000,v1=abc…` ← { t, v1 }. بيتجاهل أي أجزاء زيادة. */
export function parseSignatureHeader(
  header: string | null | undefined,
): { timestamp: number; signature: string } | null {
  if (!header) return null;
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't' && /^\d+$/.test(value)) timestamp = Number(value);
    // ⚠️ أول v1 بس: ترويسة فيها v1 مرتين (واحد صح وواحد غلط) ماتعديش
    //    بسبب الصح — بنثبت على الأولى.
    else if (key === 'v1' && signature === null && /^[0-9a-f]+$/i.test(value)) {
      signature = value.toLowerCase();
    }
  }

  if (timestamp === null || signature === null) return null;
  return { timestamp, signature };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  // لو الطول بالبايت اختلف (hex مكسور) المقارنة بترمي، فبنمنعها.
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * هل الطلب ده جاي من XPay فعلًا؟
 *
 * @param rawBody جسم الطلب **كنص خام** زي ما وصل، من غير أي تحويل.
 * @param header قيمة ترويسة `XPay-Signature`.
 * @param secret مفتاح التوقيع `whsec_...` من لوحة XPay.
 * @param nowSeconds الوقت الحالي بالثواني (للاختبار).
 */
export function verifyXpaySignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  nowSeconds: number,
): SignatureResult {
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!header) return { ok: false, reason: 'missing_header' };

  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: 'malformed_header' };

  // الفرق المطلق: التوقيع من المستقبل مرفوض زي القديم بالظبط.
  if (Math.abs(nowSeconds - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest('hex');

  if (!safeEqualHex(parsed.signature, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  return { ok: true };
}
