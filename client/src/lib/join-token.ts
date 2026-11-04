/**
 * رابط النقاش مع المتقدّم — ليه ماكانش شغّال (ملاحظة تامر، ٢٤ أكتوبر).
 *
 * ⚠️ مفتاح الطلب في القاعدة `encode(gen_random_bytes(32), 'base64')` —
 *    وده فيه `/` و`+` و`=`. الرابط كان `encodeURIComponent(token)`، فالـ`/`
 *    بقت `%2F` جوّه مسار الصفحة — والراوتر/الاستضافة بيفكّوها لـ`/` وبيدوّروا
 *    على صفحة تانية، والـ`+` بيتقري مسافة في أماكن كتير (ومنها واتساب).
 *    النتيجة: «الصفحة مش موجودة».
 *
 *    الحل من غير ما نغيّر المفاتيح القديمة: الرابط بقى بالشكل الآمن
 *    (base64url: `-` بدل `+`، `_` بدل `/`، من غير `=`)، والصفحة بترجّعه
 *    لأصله قبل ما تسأل القاعدة. والروابط القديمة المشفّرة بتتفك كمان.
 */

export function toUrlToken(token: string): string {
  return token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromUrlToken(param: string): string {
  let t = param;
  try {
    t = decodeURIComponent(param);
  } catch {
    /* مش مشفّر */
  }
  // رابط قديم: `+` اتحوّلت مسافة في الطريق.
  t = t.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
  const pad = t.length % 4;
  return pad ? t + '='.repeat(4 - pad) : t;
}

/**
 * رابط واتساب برسالة جاهزة. الرقم بيتحوّل لدولي: `01…` (مصر) ← `201…`،
 * و`+`/`00` بيتشالوا.
 */
export function whatsappLink(phone: string, text: string): string | null {
  let digits = (phone ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `2${digits}`;
  digits = digits.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
