import { describe, it, expect } from 'vitest';
import type { DeliveryCatalog } from '@/data/domains/(shared)/shipping/types';
import {
  areasOf,
  COUNTRY_CLOSED_MESSAGE,
  defaultCountryCode,
  electronicVerdict,
  governoratesOf,
  physicalClosedForCountry,
  physicalVerdict,
} from './delivery';

const catalog = (over: Partial<DeliveryCatalog> = {}): DeliveryCatalog => ({
  countries: [
    {
      code: 'EG', nameAr: 'مصر', dialCode: '+20', isDefault: true, isListed: true,
      physicalEnabled: true, electronicEnabled: true, unavailableMessage: null, sortOrder: 1,
    },
    {
      code: 'SA', nameAr: 'السعودية', dialCode: '+966', isDefault: false, isListed: true,
      physicalEnabled: false, electronicEnabled: false, unavailableMessage: null, sortOrder: 10,
    },
    {
      code: 'AE', nameAr: 'الإمارات', dialCode: '+971', isDefault: false, isListed: true,
      physicalEnabled: false, electronicEnabled: true, unavailableMessage: 'قريبًا جدًا', sortOrder: 11,
    },
  ],
  governorates: [
    { id: 'g1', countryCode: 'EG', nameAr: 'القاهرة', physicalEnabled: true, isActive: true, sortOrder: 1 },
    { id: 'g2', countryCode: 'EG', nameAr: 'أسوان', physicalEnabled: false, isActive: true, sortOrder: 2 },
    { id: 'g3', countryCode: 'EG', nameAr: 'مخفية', physicalEnabled: true, isActive: false, sortOrder: 3 },
  ],
  rates: [
    { countryCode: 'EG', governorate: 'القاهرة', city: 'القاهرة', fee: 60 },
    { countryCode: 'EG', governorate: 'القاهرة', city: 'الشروق', fee: 80 },
    { countryCode: 'EG', governorate: 'أسوان', city: 'أسوان', fee: 120 },
  ],
  pause: { paused: false, message: '' },
  ...over,
});

describe('delivery — نفس قواعد shipping_quote في القاعدة (للعرض فقط)', () => {
  it('مصر مفتوحة: السعر من المنطقة', () => {
    expect(physicalVerdict(catalog(), { country: 'EG', governorate: 'القاهرة', city: 'الشروق' })).toEqual({
      available: true,
      fee: 80,
    });
  });

  it('دولة مقفولة: الرسالة الافتراضية «غير متاح الآن — سيتم التوفير قريبًا»', () => {
    const v = physicalVerdict(catalog(), { country: 'SA', governorate: '', city: '' });
    expect(v).toEqual({ available: false, reason: 'country_closed', message: COUNTRY_CLOSED_MESSAGE });
  });

  it('رسالة الأدمن المخصصة للدولة تغلب الافتراضية', () => {
    const v = physicalVerdict(catalog(), { country: 'AE', governorate: '', city: '' });
    expect(v).toMatchObject({ available: false, message: 'قريبًا جدًا' });
  });

  it('دولة مجهولة مرفوضة', () => {
    expect(physicalVerdict(catalog(), { country: 'XX', governorate: '', city: '' })).toMatchObject({
      available: false,
      reason: 'country_unknown',
    });
  });

  it('محافظة مقفولة تمنع كل مناطقها', () => {
    expect(physicalVerdict(catalog(), { country: 'EG', governorate: 'أسوان', city: 'أسوان' })).toMatchObject({
      available: false,
      reason: 'governorate_closed',
    });
  });

  it('منطقة غير موجودة/مقفولة (غير ظاهرة) مرفوضة', () => {
    expect(physicalVerdict(catalog(), { country: 'EG', governorate: 'القاهرة', city: 'مدينة نصر' })).toMatchObject({
      available: false,
      reason: 'area_closed',
    });
  });

  it('الإيقاف العام يغلب كل شيء ويحترم رسالة الأدمن', () => {
    const paused = catalog({ pause: { paused: true, message: 'إجازة العيد' } });
    expect(physicalVerdict(paused, { country: 'EG', governorate: 'القاهرة', city: 'القاهرة' })).toEqual({
      available: false,
      reason: 'paused',
      message: 'إجازة العيد',
    });
    const noMsg = catalog({ pause: { paused: true, message: '  ' } });
    expect(physicalVerdict(noMsg, { country: 'EG', governorate: 'القاهرة', city: 'القاهرة' })).toMatchObject({
      reason: 'paused',
    });
  });

  it('الإقفال على مستوى الدولة يظهر فور اختيارها، ومقفول المحافظة لا', () => {
    expect(physicalClosedForCountry(catalog(), 'SA')).toEqual({ closed: true, message: COUNTRY_CLOSED_MESSAGE });
    expect(physicalClosedForCountry(catalog(), 'EG')).toEqual({ closed: false });
    expect(physicalClosedForCountry(catalog({ pause: { paused: true, message: '' } }), 'EG')).toMatchObject({
      closed: true,
    });
  });

  it('النسخة الإلكترونية حسب الدولة، والإيقاف العام لا يؤثر عليها', () => {
    expect(electronicVerdict(catalog(), 'EG')).toEqual({ allowed: true });
    expect(electronicVerdict(catalog(), 'SA')).toMatchObject({ allowed: false });
    expect(electronicVerdict(catalog(), 'AE')).toEqual({ allowed: true });
    expect(electronicVerdict(catalog({ pause: { paused: true, message: '' } }), 'EG')).toEqual({ allowed: true });
    expect(electronicVerdict(catalog(), 'XX')).toMatchObject({ allowed: false });
  });

  it('قوائم الاختيار: المحافظات الظاهرة فقط، مرتبة، والمناطق بالاسم', () => {
    expect(governoratesOf(catalog(), 'EG').map((g) => g.nameAr)).toEqual(['القاهرة', 'أسوان']);
    expect(areasOf(catalog(), 'EG', 'القاهرة').map((a) => a.city)).toEqual(['الشروق', 'القاهرة'].sort((a, b) => a.localeCompare(b, 'ar')));
  });

  it('الدولة الافتراضية: isDefault ثم مصر', () => {
    expect(defaultCountryCode(catalog().countries)).toBe('EG');
    const noDefault = catalog().countries.map((c) => ({ ...c, isDefault: false }));
    expect(defaultCountryCode(noDefault)).toBe('EG');
    expect(defaultCountryCode([])).toBe('EG');
  });
});
