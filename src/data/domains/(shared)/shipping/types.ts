/** رمز الدولة (ISO 3166-1 alpha-2، حروف كبيرة) — مصر هي الافتراضي. */
export type CountryCode = string;

export type Country = {
  code: CountryCode;
  nameAr: string;
  dialCode: string | null;
  isDefault: boolean;
  isListed: boolean;
  /** توصيل النسخ المطبوعة والإضافات والصندوق. */
  physicalEnabled: boolean;
  /** بيع النسخة الإلكترونية. */
  electronicEnabled: boolean;
  /** رسالة العميل لما التوصيل مقفول (الافتراضي: «غير متاح الآن — سيتم التوفير قريبًا»). */
  unavailableMessage: string | null;
  sortOrder: number;
};

export type Governorate = {
  id: string;
  countryCode: CountryCode;
  nameAr: string;
  /** إغلاق المحافظة كلها دون حذف مناطقها. */
  physicalEnabled: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type ShippingRate = {
  countryCode: CountryCode;
  governorate: string;
  /** The city or district within it — Cairo and Shorouk are not the same trip. */
  city: string;
  fee: number;
};

export type ShippingRateRow = ShippingRate & {
  id: string;
  /** مفتاح فتح/إغلاق المنطقة. */
  isActive: boolean;
  /** قيمة تقديرية لم تُراجَع مع شركة الشحن. */
  isEstimate: boolean;
};

/** إيقاف التوصيل العام (النسخة الإلكترونية تبقى متاحة). */
export type DeliveryPause = { paused: boolean; message: string };

/** كل ما تحتاجه شاشة الدفع لعرض الاختيارات وشرح الإغلاق. */
export type DeliveryCatalog = {
  countries: Country[];
  governorates: Governorate[];
  rates: ShippingRate[];
  pause: DeliveryPause;
};
