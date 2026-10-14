import type {
  Country,
  DeliveryCatalog,
  Governorate,
  ShippingRate,
} from '@/data/domains/(shared)/shipping/types';

/**
 * التوصيل حسب الدولة والمحافظة والمنطقة — **للعرض فقط**.
 *
 * ⚠️ الحارس الحقيقي هو الدالة `shipping_quote` في القاعدة، اللي بتناديها
 *    `create_customer_order` و`create_box_subscription_order`. هنا بنعيد
 *    نفس القواعد عشان العميل يشوف السبب قبل ما يضغط «تسجيل الطلب»، لا
 *    عشان نعتمد على الواجهة. أي تعديل في القواعد لازم يتعمل في الاتنين.
 */

export const DEFAULT_COUNTRY_CODE = 'EG';

export const COUNTRY_CLOSED_MESSAGE = 'غير متاح الآن — سيتم التوفير قريبًا';
export const PAUSED_MESSAGE = 'التوصيل متوقف مؤقتًا — يمكنك طلب النسخة الإلكترونية';
export const GOVERNORATE_CLOSED_MESSAGE = 'التوصيل لهذه المحافظة غير متاح الآن';
export const AREA_CLOSED_MESSAGE = 'التوصيل لهذه المنطقة غير متاح الآن';
export const ELECTRONIC_CLOSED_MESSAGE = 'النسخة الإلكترونية مش متاحة في بلدك دلوقتي';

export type DeliveryVerdict =
  | { available: true; fee: number }
  | {
      available: false;
      reason: 'country_unknown' | 'paused' | 'country_closed' | 'governorate_closed' | 'area_closed';
      message: string;
    };

export function findCountry(catalog: DeliveryCatalog, code: string): Country | undefined {
  return catalog.countries.find((c) => c.code === code);
}

/** الدولة الافتراضية: اللي عليها `isDefault`، وإلا مصر، وإلا أول دولة. */
export function defaultCountryCode(countries: Country[]): string {
  return (
    countries.find((c) => c.isDefault)?.code ??
    countries.find((c) => c.code === DEFAULT_COUNTRY_CODE)?.code ??
    countries[0]?.code ??
    DEFAULT_COUNTRY_CODE
  );
}

export function governoratesOf(catalog: DeliveryCatalog, countryCode: string): Governorate[] {
  return catalog.governorates
    .filter((g) => g.countryCode === countryCode && g.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, 'ar'));
}

export function areasOf(
  catalog: DeliveryCatalog,
  countryCode: string,
  governorate: string,
): ShippingRate[] {
  return catalog.rates
    .filter((r) => r.countryCode === countryCode && r.governorate === governorate)
    .sort((a, b) => a.city.localeCompare(b.city, 'ar'));
}

/** هل التوصيل المادي (مطبوع/إضافة/صندوق) متاح للاختيار ده؟ */
export function physicalVerdict(
  catalog: DeliveryCatalog,
  sel: { country: string; governorate: string; city: string },
): DeliveryVerdict {
  const country = findCountry(catalog, sel.country);
  if (!country || !country.isListed) {
    return { available: false, reason: 'country_unknown', message: 'الدولة غير مدعومة' };
  }
  if (catalog.pause.paused) {
    return {
      available: false,
      reason: 'paused',
      message: catalog.pause.message.trim() || PAUSED_MESSAGE,
    };
  }
  if (!country.physicalEnabled) {
    return {
      available: false,
      reason: 'country_closed',
      message: country.unavailableMessage?.trim() || COUNTRY_CLOSED_MESSAGE,
    };
  }
  if (sel.governorate) {
    const gov = catalog.governorates.find(
      (g) => g.countryCode === country.code && g.nameAr === sel.governorate && g.isActive,
    );
    if (gov && !gov.physicalEnabled) {
      return { available: false, reason: 'governorate_closed', message: GOVERNORATE_CLOSED_MESSAGE };
    }
  }
  const rate = catalog.rates.find(
    (r) =>
      r.countryCode === country.code && r.governorate === sel.governorate && r.city === sel.city,
  );
  if (!rate) {
    return { available: false, reason: 'area_closed', message: AREA_CLOSED_MESSAGE };
  }
  return { available: true, fee: rate.fee };
}

/**
 * التوصيل المادي مقفول على مستوى الدولة أو عالميًا (قبل اختيار محافظة)؟
 * بيُستعمل لعرض الرسالة فور اختيار الدولة.
 */
export function physicalClosedForCountry(
  catalog: DeliveryCatalog,
  countryCode: string,
): { closed: false } | { closed: true; message: string } {
  const verdict = physicalVerdict(catalog, { country: countryCode, governorate: '', city: '' });
  if (verdict.available) return { closed: false };
  if (verdict.reason === 'paused' || verdict.reason === 'country_closed' || verdict.reason === 'country_unknown') {
    return { closed: true, message: verdict.message };
  }
  return { closed: false };
}

/** النسخة الإلكترونية: متاحة في الدولة دي؟ (إيقاف التوصيل لا يؤثر عليها.) */
export function electronicVerdict(
  catalog: DeliveryCatalog,
  countryCode: string,
): { allowed: true } | { allowed: false; message: string } {
  const country = findCountry(catalog, countryCode);
  if (!country || !country.isListed || !country.electronicEnabled) {
    return { allowed: false, message: ELECTRONIC_CLOSED_MESSAGE };
  }
  return { allowed: true };
}

/**
 * اسم الدولة بالعربي من رمزها (للعرض في الطلبات). `Intl.DisplayNames` بيدّي
 * الاسم الرسمي («المملكة العربية السعودية»)، وبنرجع الرمز لو المتصفح/الخادم
 * ماعندوش بيانات اللغة.
 */
export function countryNameAr(code: string | null | undefined): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['ar'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
