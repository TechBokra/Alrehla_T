/**
 * Uploading an image to Cloudinary from the browser.
 *
 * The personalisation wizard used to store only the file's NAME, discarding
 * the file itself — so a customer paid for a book whose hero was drawn from a
 * photo the platform never received, while the screen said "تم إرفاق صورة
 * شخصية".
 *
 * The preset is unsigned, so no secret is involved and nothing here needs a
 * server round-trip; the cloud name and preset are public by design.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwg0hr34g';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'alreha';

const MAX_BYTES = 10 * 1024 * 1024;
// SVG مسموح للشعارات: التحويلات على Cloudinary بتحوّله لصورة نقطية عند
// العرض، فمفيش أي كود جواه بيتنفّذ في متصفح الزائر.
const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/svg+xml',
];

export type UploadedImage = {
  url: string;
  publicId: string;
};

export async function uploadImage(file: File, folder = 'alrehla'): Promise<UploadedImage> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('نوع الملف غير مدعوم — استخدم صورة JPG أو PNG');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('حجم الصورة كبير — الحد الأقصى 10 ميجابايت');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', UPLOAD_PRESET);
  body.append('folder', folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Cloudinary upload failed', response.status, detail);
    throw new Error('تعذّر رفع الصورة، برجاء المحاولة مرة أخرى');
  }

  const data = (await response.json()) as { secure_url?: string; public_id?: string };
  if (!data.secure_url) throw new Error('تعذّر رفع الصورة');

  return { url: data.secure_url, publicId: data.public_id ?? '' };
}

/**
 * A delivery URL that is optimised for the browser asking for it.
 *
 * Images were served exactly as uploaded: an 8MB phone photo reached every
 * visitor at full size. `f_auto` picks the best format the browser supports
 * (usually WebP or AVIF), `q_auto` picks a quality that is visually
 * indistinguishable, and `c_limit,w_…` caps the width without ever enlarging
 * or cropping. This typically cuts the bytes transferred by more than half,
 * which is what actually consumes a Cloudinary plan.
 *
 * A non-Cloudinary URL is returned untouched, so this is safe to apply to any
 * image the site has.
 */
export function optimizedImageUrl(url: string | null | undefined, width = 800): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  // Don't stack transformations on a URL that already carries some.
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto:good,c_limit,w_${width}/`);
}

/**
 * رابط صورة مظبوط على مقاس خانة معيّنة — **من غير قص**.
 *
 * المشكلة اللي بيحلّها: الصور بتترفع بأي مقاس (صورة موبايل طولية، لقطة شاشة
 * عريضة)، والموقع بيعرضها في مكان له نسبة ثابتة. الطريقة الافتراضية في CSS
 * (`object-cover`) بتملا المكان بقص الأطراف — فالوش يتقطع أو العنوان يختفي.
 *
 * الحل هنا إن Cloudinary هو اللي يظبط المقاس قبل ما الصورة توصل المتصفح:
 *
 *   c_pad + b_auto  → الصورة كاملة جوّه المقاس المطلوب، والفراغ الجانبي
 *                     بيتملّي بلون مسحوب من أطراف الصورة نفسها، فالنتيجة
 *                     بتبان طبيعية مش إطار أبيض.
 *   c_fit           → الصورة كاملة من غير ملء — للشعارات والأيقونات، عشان
 *                     الشفافية ما تتحوّلش للون.
 *
 * في الحالتين الصورة بتوصل بالنسبة المضبوطة، فـ `object-cover` في CSS
 * مالهاش أي حاجة تقصّها.
 *
 * `dpr_auto` بيخلي الشاشات عالية الدقة تاخد نسخة أوضح من غير ما الشاشات
 * العادية تحمّل بايت زيادة.
 */
import { SITE_IMAGE_BY_KEY, type SiteImageKey } from '@/lib/site-images';

export function slotImageUrl(
  url: string | null | undefined,
  key: SiteImageKey,
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url;

  const slot = SITE_IMAGE_BY_KEY[key];
  if (!slot) return optimizedImageUrl(url);

  // q_auto لوحدها بتنزل لجودة منخفضة على الصور اللي فيها تدرّجات
  // ناعمة، فبتبان مبقّعة. :good بيحط حد أدنى للجودة والفرق في الحجم بسيط.
  const parts = ['f_auto', 'q_auto:good', 'dpr_auto', `w_${slot.w}`];
  if (slot.fit === 'pad') {
    // قص ذكي: Cloudinary بيحلّل الصورة ويقص حواليها، فالصورة بتملا
    // المكان بالكامل من غير أشرطة لونية على الجنب.
    //
    // اللي كان قبله: c_pad + b_auto — الصورة كاملة والفراغ بيتملّي بلون
    // مسحوب من أطرافها. ما كانش بيقص حاجة، لكن الشريط اللوني بيبان
    // كأنه فلتر على الصورة.
    parts.push('c_fill', 'g_auto');
    if (slot.ar) parts.push(`ar_${slot.ar}`);
  } else {
    parts.push('c_fit');
    if (slot.ar) parts.push(`h_${slot.w}`);
  }

  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

/**
 * نفس صورة الخانة، **بنسبة ومقاس مختلفين** — للصور اللي حاويتها
 * بتغيّر شكلها حسب الشاشة.
 *
 * ── المشكلة ─────────────────────────────────────────────────
 *
 * `slotImageUrl` بتسلّم نسبة واحدة ثابتة لكل خانة. وصورة الهيرو
 * نسبتها `21:9`، لكن الحاوية في الصفحة بتتغيّر:
 *
 *     موبايل 4:3  ←  تابلت 16:9  ←  لابتوب 21:9
 *
 * يعني على الموبايل، `object-cover` في CSS بياخد صورة **عريضة جدًا**
 * ويقصّها لمربّع تقريبًا — **فمش بيبان منها غير الشريط الأوسط**،
 * وأطراف الصورة بتروح. وأغلب الزوار على الموبايل.
 *
 * ── والحل مش تصغير الصورة ───────────────────────────────────
 *
 * ⚠️ **الفرق اللي بيهم**: القص هنا بيتحسب من **الصورة الأصلية**، مش
 *    من نسخة الـ21:9. يعني `g_auto` بيحلّل الصورة كلها ويختار أحسن
 *    قصّة 4:3 — بدل ما ياخد قصّة عريضة اتقصّت أصلًا ويقصّها تاني.
 *    قص القص بيضيّع نص الصورة؛ ده بيحافظ عليها.
 *
 * ⚠️ **وبيوفّر بايتات كمان**: الموبايل بيحمّل 900 بكسل عرض بدل 2100.
 *
 * بتترجع فاضية لو الرابط مش من Cloudinary أو عليه تحويلات قبل كده —
 * وساعتها الاستدعاء بيرجع للسلوك العادي.
 */
export function slotImageUrlAt(
  url: string | null | undefined,
  ar: string,
  width: number,
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url;

  const parts = ['f_auto', 'q_auto:good', 'dpr_auto', `w_${width}`, 'c_fill', 'g_auto', `ar_${ar}`];
  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

/**
 * صورة بديلة صغيرة جدًا (20 بكسل مموّهة) تُعرض لحظة تحميل الصورة الأصلية.
 *
 * بدل ما المكان يفضل فاضي أبيض وبعدين الصورة تنطّ فيه، بيظهر شكل مموّه
 * بألوان الصورة الحقيقية — الصفحة بتحس مستقرة وأسرع حتى لو الوقت واحد.
 */
export function blurPlaceholder(url: string | null | undefined): string | undefined {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return undefined;
  }
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return undefined;
  return url.replace('/upload/', '/upload/f_auto,q_auto:low,e_blur:800,w_20/');
}
