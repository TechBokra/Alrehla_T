/**
 * الدومينات اللي `next/image` مسموح يحمّل منها.
 *
 * ── ليه الملف ده موجود ──────────────────────────────────────
 *
 * `next/image` **بيرمي** على رابط من دومين مش مكتوب في
 * `images.remotePatterns`: «Invalid src prop … hostname is not
 * configured». والرمي جوّه صفحة سيرفر بيحوّل الصفحة كلها لـ«حدث خطأ غير
 * متوقع» — **صورة واحدة بتقفل شاشة إدارة كاملة**.
 *
 * والروابط في القاعدة مش كلها بتاعتنا: حساب داخل بجوجل بييجي بصورة من
 * `lh3.googleusercontent.com`، وصورة قديمة ممكن تكون مرفوعة على
 * مكان تاني، و`optimizedImageUrl` بتمرّر أي رابط مش Cloudinary زيّ
 * ما هو.
 *
 * ⚠️ **القايمة دي لازم تطابق `images.remotePatterns` في
 *    `next.config.ts`.** زوّدت دومين هناك؟ زوّده هنا، والعكس.
 */
export const ALLOWED_IMAGE_HOSTS = [
  'res.cloudinary.com',
  'ui-avatars.com',
  'picsum.photos',
] as const;

/**
 * الرابط ده ينفع يروح لـ`next/image`؟
 *
 * الروابط النسبية (`/images/x.png`) ومسارات `data:`/`blob:` بترجع
 * `false` عن قصد هنا: الدالة دي للروابط الخارجية، واللي بيستعملها
 * بيتعامل مع النسبي لوحده.
 */
export function isAllowedImageHost(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(host);
  } catch {
    // مش رابط مطلق — نسبي أو مكسور.
    return false;
  }
}
