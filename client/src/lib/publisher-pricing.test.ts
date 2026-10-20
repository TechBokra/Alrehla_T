import { describe, it, expect } from 'vitest';
import {
  customerPriceFromCost,
  platformShare,
  NEUTRAL_FORMULA,
} from './publisher-pricing';

/**
 * ⚠️ **الأرقام هنا هي القيم الحقيقية في القاعدة** (ملف 96):
 *    صفّ `publisher-default` → معامل 1.2 · رسم 30.
 *
 * الاختبارات دي بتثبّت **سلوك متفق عليه مع صاحب المشروع**: الناشر
 * بيكتب نصيبه، والموقع بيضيف هامش المنصة. لو حد غيّر الاتجاه بعدين،
 * لازم يعدّي على القرار ده الأول.
 */
const REAL = { platformMultiplier: 1.2, fixedAdminFee: 30 };

describe('سعر العميل من نصيب الناشر', () => {
  it('نصيب 100 بمعادلة الناشر الحقيقية = 150', () => {
    expect(customerPriceFromCost(100, REAL)).toBe(150);
  });

  it('بيقرّب لأقرب جنيه — السعر المخزّن هو المعروض هو المدفوع', () => {
    // 77 × 1.2 = 92.4 + 30 = 122.4
    expect(customerPriceFromCost(77, REAL)).toBe(122);
    // 75 × 1.2 = 90 + 30 = 120
    expect(customerPriceFromCost(75, REAL)).toBe(120);
  });

  it('المعادلة المحايدة تسيب النصيب زي ما هو', () => {
    expect(customerPriceFromCost(200, NEUTRAL_FORMULA)).toBe(200);
  });

  it('نصيب صفر أو بالسالب = صفر، مش الرسم الثابت وحده', () => {
    // ⚠️ لو رجّعت الرسم الثابت، كان منتج بلا نصيب هيتعرض بـ30 ج.م
    //    والناشر ياخد صفر — سعر حقيقي على منتج مش متسعّر.
    expect(customerPriceFromCost(0, REAL)).toBe(0);
    expect(customerPriceFromCost(-50, REAL)).toBe(0);
  });

  it('المعادلة الناقصة ما بتكسرش الحساب', () => {
    expect(customerPriceFromCost(100, { platformMultiplier: NaN, fixedAdminFee: NaN })).toBe(100);
  });
});

describe('نصيب المنصة', () => {
  it('الفرق بين سعر العميل ونصيب الناشر', () => {
    expect(platformShare(100, REAL)).toBe(50);
  });

  it('صفر لما مفيش سعر', () => {
    expect(platformShare(0, REAL)).toBe(0);
  });

  it('المعادلة المحايدة = المنصة ما بتاخدش حاجة', () => {
    expect(platformShare(200, NEUTRAL_FORMULA)).toBe(0);
  });
});
