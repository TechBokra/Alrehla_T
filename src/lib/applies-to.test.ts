import { describe, it, expect } from 'vitest';
import {
  appliesToProducts,
  appliesToSummary,
  isMissingSchemaError,
  isVisibleFor,
  normalizeAppliesTo,
  readAppliesTo,
} from './applies-to';

describe('isVisibleFor', () => {
  it('NULL = كل المنتجات والصندوق', () => {
    expect(isVisibleFor(null, { productId: 'p1' })).toBe(true);
    expect(isVisibleFor(null, { box: true })).toBe(true);
    expect(isVisibleFor(undefined, { productId: 'p1' })).toBe(true);
    expect(isVisibleFor([], { box: true })).toBe(true);
  });

  it('منتجات بعينها', () => {
    expect(isVisibleFor(['p1', 'p2'], { productId: 'p1' })).toBe(true);
    expect(isVisibleFor(['p1', 'p2'], { productId: 'p3' })).toBe(false);
    expect(isVisibleFor(['p1'], { box: true })).toBe(false);
  });

  it("الصندوق = 'box'", () => {
    expect(isVisibleFor(['box'], { box: true })).toBe(true);
    expect(isVisibleFor(['box'], { productId: 'p1' })).toBe(false);
    expect(isVisibleFor(['p1', 'box'], { productId: 'p1' })).toBe(true);
  });

  it('مكان مش معروف ما يشوفش المخصّص', () => {
    expect(isVisibleFor(['p1'], {})).toBe(false);
    expect(isVisibleFor(null, {})).toBe(true);
  });
});

describe('normalizeAppliesTo', () => {
  it('فاضي أو غلط = null', () => {
    expect(normalizeAppliesTo(null)).toBeNull();
    expect(normalizeAppliesTo([])).toBeNull();
    expect(normalizeAppliesTo(['', '  '])).toBeNull();
    expect(normalizeAppliesTo('p1')).toBeNull();
  });

  it('بيشيل التكرار والفراغات وغير النصوص', () => {
    expect(normalizeAppliesTo([' p1 ', 'p1', 3, 'box'])).toEqual(['p1', 'box']);
  });

  it('عمود مش موجود (قبل ملف 12) = للكل', () => {
    expect(readAppliesTo(undefined)).toBeNull();
  });
});

describe('isMissingSchemaError', () => {
  it('جدول أو عمود مش موجود', () => {
    expect(isMissingSchemaError({ code: '42P01' })).toBe(true);
    expect(isMissingSchemaError({ code: '42703' })).toBe(true);
    expect(isMissingSchemaError({ code: 'PGRST205' })).toBe(true);
    expect(isMissingSchemaError({ code: 'PGRST204' })).toBe(true);
  });

  it('أي خطأ تاني لأ', () => {
    expect(isMissingSchemaError({ code: '42501' })).toBe(false);
    expect(isMissingSchemaError(null)).toBe(false);
    expect(isMissingSchemaError({})).toBe(false);
  });
});

describe('appliesToSummary', () => {
  it('كل المنتجات', () => {
    expect(appliesToSummary(null)).toBe('بيظهر في: كل المنتجات');
  });

  it('عدد المنتجات والصندوق', () => {
    expect(appliesToSummary(['a'])).toBe('بيظهر في: منتج واحد');
    expect(appliesToSummary(['a', 'b'])).toBe('بيظهر في: منتجين');
    expect(appliesToSummary(['a', 'b', 'c'])).toBe('بيظهر في: ٣ منتجات');
    expect(appliesToSummary(['box'])).toBe('بيظهر في: صندوق الرحلة');
    expect(appliesToSummary(['a', 'box'])).toBe('بيظهر في: منتج واحد وصندوق الرحلة');
  });
});

describe('appliesToProducts', () => {
  it('المخصص والمكتبة بس', () => {
    const list = appliesToProducts([
      { id: '1', name: 'أ', category: 'custom' },
      { id: '2', name: 'ب', category: 'library' },
      { id: '3', name: 'ج', category: 'subscription' },
    ]);
    expect(list.map((p) => p.id)).toEqual(['1', '2']);
  });
});
