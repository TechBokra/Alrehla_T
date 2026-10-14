/**
 * فحص مدخلات الشحن في السيرفر — ملف عادي (مش 'use server') عشان يتختبر،
 * وعشان ملفات 'use server' ماتصدّرش غير دوال async.
 */

export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
export const MAX_DELIVERY_MESSAGE = 200;

export type AreaCheck =
  | { ok: true; country: string; gov: string; area: string }
  | { ok: false; error: string };

export function validateShippingArea(
  countryCode: string,
  governorate: string,
  city: string,
  fee: number,
): AreaCheck {
  const country = countryCode.trim().toUpperCase();
  const gov = governorate.trim();
  const area = city.trim();
  if (!COUNTRY_CODE_PATTERN.test(country)) return { ok: false, error: 'الدولة غير صحيحة' };
  if (!gov) return { ok: false, error: 'اكتب اسم المحافظة' };
  if (!area) return { ok: false, error: 'اكتب اسم المنطقة' };
  if (!Number.isFinite(fee) || fee < 0) return { ok: false, error: 'السعر غير صحيح' };
  if (fee > 100000) return { ok: false, error: 'السعر غير منطقي' };
  return { ok: true, country, gov, area };
}
