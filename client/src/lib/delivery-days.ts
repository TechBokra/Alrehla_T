/**
 * مدة تجهيز الكتاب — قرار تامر (٢٥ أكتوبر).
 *
 * «وقت التسليم لازم يكون متاح لينا ضبطه من كل كتاب أو قصة (قيمة عامة
 *  للجميع، ويمكن تغييرها من إعدادات كل كتاب أو قصة)».
 *
 *   • القيمة العامة: الإعدادات ← `deliveryDays` (في `site_settings`).
 *   • لكل كتاب: `personalized_products.delivery_days_electronic/printed`
 *     — فاضي = العامة.
 *   • المطبوع: مدة التجهيز **قبل الشحن**؛ الشحن نفسه حسب المنطقة.
 *   • انتظار موافقة العميل على صورة البطل بيتضاف على الميعاد
 *     (`waitDays` في `image-review`).
 */

export type DeliveryDays = { electronic: number; printed: number };

export const DEFAULT_DELIVERY_DAYS: DeliveryDays = { electronic: 5, printed: 10 };
export const MIN_DELIVERY_DAYS = 1;
export const MAX_DELIVERY_DAYS = 120;

function dayCount(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= MIN_DELIVERY_DAYS && r <= MAX_DELIVERY_DAYS ? r : null;
}

/** القيمة العامة من الإعدادات — أي رقم بايظ بيرجع للافتراضي. */
export function normalizeDeliveryDays(value: unknown): DeliveryDays {
  const v = (value ?? {}) as Partial<Record<keyof DeliveryDays, unknown>>;
  return {
    electronic: dayCount(v.electronic) ?? DEFAULT_DELIVERY_DAYS.electronic,
    printed: dayCount(v.printed) ?? DEFAULT_DELIVERY_DAYS.printed,
  };
}

/** خانة الكتاب: فاضية أو بايظة = `null` (يعني العامة). */
export function productDayOverride(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return dayCount(value);
}

export type ProductDeliveryOverride = {
  deliveryDaysElectronic?: number | null;
  deliveryDaysPrinted?: number | null;
};

/** المدة الفعلية للكتاب ده. */
export function effectiveDeliveryDays(
  global: DeliveryDays,
  product: ProductDeliveryOverride | null | undefined,
): DeliveryDays {
  return {
    electronic: productDayOverride(product?.deliveryDaysElectronic) ?? global.electronic,
    printed: productDayOverride(product?.deliveryDaysPrinted) ?? global.printed,
  };
}

export function daysLabel(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n >= 3 && n <= 10) return `${n.toLocaleString('ar-EG')} أيام`;
  return `${n.toLocaleString('ar-EG')} يوم`;
}

/** السطر اللي بيتعرض للعميل. */
export function deliveryText(days: DeliveryDays, format: 'electronic' | 'printed' | 'both'): string {
  if (format === 'electronic') return `النسخة الإلكترونية بتجهز خلال ${daysLabel(days.electronic)} من تأكيد الطلب`;
  if (format === 'printed') return `النسخة المطبوعة بتجهز خلال ${daysLabel(days.printed)} من تأكيد الطلب، وبعدها الشحن`;
  return `الإلكترونية خلال ${daysLabel(days.electronic)} · المطبوعة خلال ${daysLabel(days.printed)} + الشحن`;
}

/** تنبيه تأخير المراجعة — نص واحد في كل مكان. */
export const REVIEW_DELAY_NOTE = 'بنبعتلك صورة البطل تعتمدها قبل الرسم، وأي تأخير في الاعتماد بيأخّر ميعاد التسليم بنفس المدة.';

/**
 * الميعاد المتوقع لجاهزية بند: تأكيد الطلب + مدة التجهيز + أيام انتظار
 * قرار العميل.
 */
export function expectedReadyDate(confirmedAt: string | Date, days: number, waitedDays = 0): Date {
  const start = typeof confirmedAt === 'string' ? new Date(confirmedAt) : confirmedAt;
  return new Date(start.getTime() + (days + Math.max(0, waitedDays)) * 24 * 60 * 60 * 1000);
}
