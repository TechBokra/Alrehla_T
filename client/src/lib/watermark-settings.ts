import { WATERMARK_TEXT } from '@/lib/site-url';

/**
 * إعدادات العلامة المائية — من «الإعدادات العامة» في لوحة الإدارة
 * (قرار تامر، 9 أكتوبر: «التعديل يكون في لوحة التحكم مع إمكانية
 * التفعيل أو لا»).
 *
 * الملف ده **من غير خادم** عن قصد: شاشة الإعدادات بتستعمله عشان تعرض
 * معاينة حيّة وأنت بتغيّر، والصفحات العامة بتستعمله عشان تبني العلامة —
 * نفس الدالة في المكانين، فاللي بتشوفه في المعاينة هو اللي بيطلع.
 *
 * ⚠️ **الأماكن المتاحة اتنين بس، والأركان مش منهم:** خانات الموقع بتقص
 *    الصورة من الجناب أو من فوق وتحت على حسب الشاشة (وصل لـ٢٢٪ من تحت)،
 *    والأركان أول حاجة بتروح. «تحت» هنا مرفوعة ربع الصورة عشان كده.
 */

export type WatermarkStyle = 'light' | 'dark';
export type WatermarkSize = 'small' | 'medium' | 'large';
export type WatermarkPosition = 'bottom' | 'center';

/**
 * شكل العلامة.
 *
 * ⚠️ **`badge` هو اللي كان موجود لوحده — ودي كانت المشكلة.** كتابة على
 *    خلفية مصمتة بحواف مدوّرة بتبان **ملصق متحطّ فوق الصورة**، مش علامة
 *    مائية. `plain` كتابة شفافة من غير خلفية، بتندمج في الصورة —
 *    وهي اللي الناس بتسمّيها «علامة مائية».
 */
export type WatermarkLook = 'plain' | 'badge';

/** شفافية العلامة — المعنى الحقيقي لكلمة «مائية». */
export type WatermarkOpacity = 'soft' | 'medium' | 'strong';

export type WatermarkSettings = {
  enabled: boolean;
  text: string;
  style: WatermarkStyle;
  size: WatermarkSize;
  position: WatermarkPosition;
  look: WatermarkLook;
  opacity: WatermarkOpacity;
};

export const DEFAULT_WATERMARK_TEXT = `الرحلة  •  ${WATERMARK_TEXT}`;
export const WATERMARK_TEXT_MAX = 40;

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: true,
  text: DEFAULT_WATERMARK_TEXT,
  style: 'light',
  size: 'medium',
  position: 'bottom',
  look: 'plain',
  opacity: 'medium',
};

export const WATERMARK_STYLES: { value: WatermarkStyle; label: string }[] = [
  { value: 'light', label: 'فاتحة — كتابة كحلي على أبيض' },
  { value: 'dark', label: 'غامقة — كتابة بيضا على كحلي' },
];
export const WATERMARK_SIZES: { value: WatermarkSize; label: string }[] = [
  { value: 'small', label: 'صغيرة' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'large', label: 'كبيرة' },
];
export const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'bottom', label: 'تحت في النص' },
  { value: 'center', label: 'في نص الصورة' },
];

export const WATERMARK_LOOKS: { value: WatermarkLook; label: string }[] = [
  { value: 'plain', label: 'علامة مائية — كتابة شفافة من غير خلفية' },
  { value: 'badge', label: 'بطاقة — كتابة على خلفية (الشكل القديم)' },
];
export const WATERMARK_OPACITIES: { value: WatermarkOpacity; label: string }[] = [
  { value: 'soft', label: 'خفيفة جدًا' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'strong', label: 'واضحة' },
];

const WIDTH: Record<WatermarkSize, number> = { small: 0.18, medium: 0.24, large: 0.32 };
/** شفافية الطبقة في Cloudinary (`o_`). البطاقة بتحتاج أعلى شوية عشان تفضل مقروءة. */
const OPACITY: Record<WatermarkOpacity, { plain: number; badge: number }> = {
  soft: { plain: 18, badge: 45 },
  medium: { plain: 32, badge: 70 },
  strong: { plain: 55, badge: 100 },
};
const COLORS: Record<WatermarkStyle, { text: string; bg: string }> = {
  light: { text: '1e3a8a', bg: 'ffffffcc' },
  dark: { text: 'ffffff', bg: '1e3a8acc' },
};

/**
 * الكتابة بعد التنظيف.
 *
 * ⚠️ **`/` و`,` و`%` بيكسروا رابط Cloudinary** (الرابط نفسه مفصول بيهم)،
 *    فبيتشالوا. والأسطر والمسافات الزيادة بتتلم.
 */
export function cleanWatermarkText(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[/\\,%?#]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {3,}/g, '  ')
    .trim()
    .slice(0, WATERMARK_TEXT_MAX);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** القيمة المحفوظة (أو مفيش) ← إعدادات سليمة. */
export function normalizeWatermark(raw: unknown): WatermarkSettings {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof WatermarkSettings, unknown>>;
  return {
    // ⚠️ مفيش قيمة محفوظة = **شغّالة**: ده اللي كان قبل الإعداد ده.
    enabled: v.enabled === undefined ? true : v.enabled === true,
    text: cleanWatermarkText(v.text) || DEFAULT_WATERMARK_TEXT,
    style: pick(v.style, ['light', 'dark'] as const, DEFAULT_WATERMARK.style),
    size: pick(v.size, ['small', 'medium', 'large'] as const, DEFAULT_WATERMARK.size),
    position: pick(v.position, ['bottom', 'center'] as const, DEFAULT_WATERMARK.position),
    // ⚠️ **القيمة المحفوظة قبل الإعداد ده = `badge`**، مش الافتراضي
    //    الجديد. الإعدادات القديمة اتحفظت والعلامة كانت بطاقة فعلًا،
    //    فتحويلها لشفافة من غير ما حد يطلب بيغيّر صور الموقع كلها في
    //    سكوت. الجديد بيبدأ `plain`؛ القديم بيفضل زيّ ما هو لحد ما
    //    الإدارة تغيّره.
    look: pick(v.look, ['plain', 'badge'] as const, v.style === undefined ? 'plain' : 'badge'),
    opacity: pick(v.opacity, ['soft', 'medium', 'strong'] as const, DEFAULT_WATERMARK.opacity),
  };
}

/**
 * طبقة Cloudinary للعلامة، أو `null` لو مقفولة (الصور بتطلع زي ما هي).
 *
 * بطاقة واحدة: كتابة على خلفية شفافة شوية وحواف مدوّرة. العرض نسبة من
 * عرض الصورة، فالبطاقة بنفس الحجم النسبي على أي مقاس.
 */
export function watermarkLayer(settings: WatermarkSettings): string | null {
  if (!settings.enabled) return null;
  const text = cleanWatermarkText(settings.text) || DEFAULT_WATERMARK_TEXT;
  const { text: color, bg } = COLORS[settings.style];
  const place = settings.position === 'center' ? 'g_center' : 'g_south,y_0.24';
  const o = OPACITY[settings.opacity][settings.look];

  // ⚠️ **الشفافية بتتحط على الطبقة نفسها (`o_`)، مش على لون الخلفية.**
  //    لو اتحطت على اللون بس، الكتابة تفضل مصمتة فوق خلفية شفافة —
  //    وده بيبان أوحش من الاتنين.
  const common = `co_rgb:${color},fl_relative,w_${WIDTH[settings.size]},o_${o},${place}`;

  if (settings.look === 'plain') {
    // من غير خلفية ولا إطار — كتابة شفافة بتندمج في الصورة.
    return `l_text:Cairo_40_bold:${encodeURIComponent(text)},${common}`;
  }

  return (
    `l_text:Cairo_40_bold:${encodeURIComponent(text)},` +
    `b_rgb:${bg},bo_12px_solid_rgb:${bg},r_16,${common}`
  );
}
