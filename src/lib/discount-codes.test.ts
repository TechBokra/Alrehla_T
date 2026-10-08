import { describe, it, expect } from 'vitest';
import { discountAmount, isValidDiscountCode, linesSummary, normalizeDiscountCode } from './discount-codes';

describe('أكواد الخصم — نفس حساب القاعدة (ملف 13)', () => {
  it('النسبة لأقرب جنيه', () => {
    expect(discountAmount(200, 10)).toBe(20);
    expect(discountAmount(1200, 20)).toBe(240);
    expect(discountAmount(155, 10)).toBe(16); // 15.5 → 16 زي round() في Postgres
  });

  it('مفيش خصم على صفر أو سالب، والنسبة مقفولة على ٩٠', () => {
    expect(discountAmount(0, 50)).toBe(0);
    expect(discountAmount(-10, 50)).toBe(0);
    expect(discountAmount(100, 95)).toBe(90);
  });

  it('الكود بيتكتب بحروف كبيرة، وبنفس قيد القاعدة', () => {
    expect(normalizeDiscountCode('  ramadan10 ')).toBe('RAMADAN10');
    expect(isValidDiscountCode('ramadan-10')).toBe(true);
    expect(isValidDiscountCode('ab')).toBe(false);
    expect(isValidDiscountCode('رمضان')).toBe(false);
    expect(isValidDiscountCode('HAS SPACE')).toBe(false);
  });

  it('الأقسام', () => {
    expect(linesSummary(null)).toBe('كل المنصة');
    expect(linesSummary(['box'])).toBe('صندوق الرحلة');
  });
});
