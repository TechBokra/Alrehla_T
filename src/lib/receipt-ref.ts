/**
 * إيصال الدفع — **مرجع** مش رابط.
 *
 * ── المشكلة ────────────────────────────────────────────────
 *
 * صورة الإيصال كانت بتترفع بنفس طريقة صور المنتجات: **رابط عام دائم**.
 * والإيصال فيه رقم التحويل والمحفظة وأحيانًا اسم صاحب الحساب — وأي حد
 * يوصله الرابط (من سجل المتصفح، أو لقطة شاشة للوحة) يشوفه للأبد.
 *
 * دلوقتي بيترفع **خاص** (زي صور وشوش الأطفال، `cloudinary-private`)،
 * والطلب بيحفظ مرجع: `private:<الامتداد>:<رقم الصورة>`. والإدارة بتشوفه
 * برابط **بينتهي بعد ساعة**.
 *
 * ⚠️ الإيصالات القديمة (روابط عامة) بتفضل شغّالة زي ما هي — مفيش
 *    حاجة اتمسحت ولا اتنقلت.
 */

export const RECEIPTS_FOLDER = 'alrehla/private/receipts';
const PREFIX = 'private:';

export function makeReceiptRef(photo: { publicId: string; format: string }): string {
  return `${PREFIX}${photo.format}:${photo.publicId}`;
}

export function parseReceiptRef(ref: string | null | undefined): { publicId: string; format: string } | null {
  if (!ref?.startsWith(PREFIX)) return null;
  const rest = ref.slice(PREFIX.length);
  const i = rest.indexOf(':');
  if (i <= 0) return null;
  const format = rest.slice(0, i);
  const publicId = rest.slice(i + 1);
  if (!/^[a-z0-9]{2,5}$/i.test(format)) return null;
  if (!publicId.startsWith(`${RECEIPTS_FOLDER}/`) || publicId.includes('..')) return null;
  return { publicId, format };
}

/**
 * الإيصال اللي جاي من المتصفح سليم؟ مرجع خاص في مجلّد الإيصالات، أو
 * (للتوافق) رابط Cloudinary بتاعنا. أي حاجة تانية بتترفض — من غيره
 * أي حد يقدر يكتب أي رابط مكان الإيصال.
 */
export function isValidReceiptRef(ref: string | null | undefined): boolean {
  if (!ref) return false;
  if (parseReceiptRef(ref)) return true;
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(ref);
}
