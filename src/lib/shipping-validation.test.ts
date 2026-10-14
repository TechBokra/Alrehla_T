import { describe, it, expect } from 'vitest';
import { validateShippingArea } from './shipping-validation';

describe('validateShippingArea', () => {
  it('يقبل مدخلات سليمة ويوحّد الدولة لحروف كبيرة ويقصّ المسافات', () => {
    expect(validateShippingArea(' eg ', ' القاهرة ', ' الشروق ', 80)).toEqual({
      ok: true,
      country: 'EG',
      gov: 'القاهرة',
      area: 'الشروق',
    });
  });

  it('يقبل صفر (شحن مجاني)', () => {
    expect(validateShippingArea('EG', 'القاهرة', 'القاهرة', 0)).toMatchObject({ ok: true });
  });

  it.each([
    ['', 'ا', 'ب', 10, 'الدولة غير صحيحة'],
    ['EGY', 'ا', 'ب', 10, 'الدولة غير صحيحة'],
    ['E1', 'ا', 'ب', 10, 'الدولة غير صحيحة'],
    ['EG', ' ', 'ب', 10, 'اكتب اسم المحافظة'],
    ['EG', 'ا', ' ', 10, 'اكتب اسم المنطقة'],
    ['EG', 'ا', 'ب', -1, 'السعر غير صحيح'],
    ['EG', 'ا', 'ب', Number.NaN, 'السعر غير صحيح'],
    ['EG', 'ا', 'ب', Number.POSITIVE_INFINITY, 'السعر غير صحيح'],
    ['EG', 'ا', 'ب', 100001, 'السعر غير منطقي'],
  ])('يرفض %j %j %j %j', (country, gov, city, fee, error) => {
    expect(validateShippingArea(country, gov, city, fee)).toEqual({ ok: false, error });
  });
});
