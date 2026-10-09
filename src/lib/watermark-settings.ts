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

export type WatermarkSettings = {
  enabled: boolean;
  text: string;
  style: WatermarkStyle;
  size: WatermarkSize;
  position: WatermarkPosition;
};

export const DEFAULT_WATERMARK_TEXT = `الرحلة  •  ${WATERMARK_TEXT}`;
export const WATERMARK_TEXT_MAX = 40;

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: true,
  text: DEFAULT_WATERMARK_TEXT,
  style: 'light',
  size: 'medium',
  position: 'bottom',
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

const WIDTH: Record<WatermarkSize, number> = { small: 0.18, medium: 0.24, large: 0.32 };
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
  return (
    `l_text:Cairo_40_bold:${encodeURIComponent(text)},co_rgb:${color},` +
    `b_rgb:${bg},bo_12px_solid_rgb:${bg},r_16,fl_relative,w_${WIDTH[settings.size]},${place}`
  );
}
