import { describe, expect, it } from 'vitest';
import {
  applyAddonPromotions,
  applyBoxPlanPromotions,
  applyProductPromotions,
  bestPromotion,
  cairoLocalToIso,
  discountedPrice,
  effectivePrice,
  isLive,
  isoToCairoLocal,
  promotionState,
  savingsPercent,
  validatePromotion,
  type Promotion,
} from './promotions';

const NOW = new Date('2026-11-05T10:00:00Z');

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p1',
    targetType: 'product_printed',
    targetId: 'prod-1',
    kind: 'percent',
    value: 20,
    label: null,
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: '2026-11-10T00:00:00Z',
    isActive: true,
    ...over,
  };
}

describe('discountedPrice', () => {
  it('نسبة: بتتقرّب لأقرب جنيه زي القاعدة', () => {
    expect(discountedPrice({ kind: 'percent', value: 20 }, 250)).toBe(200);
    expect(discountedPrice({ kind: 'percent', value: 15 }, 50)).toBe(43); // ٤٢٫٥ ← ٤٣
    expect(discountedPrice({ kind: 'percent', value: 33 }, 100)).toBe(67);
  });
  it('سعر عرض: مابيرفعش السعر', () => {
    expect(discountedPrice({ kind: 'sale_price', value: 150 }, 200)).toBe(150);
    expect(discountedPrice({ kind: 'sale_price', value: 300 }, 200)).toBe(200);
  });
});

describe('isLive / promotionState', () => {
  it('البداية شاملة والنهاية مش شاملة', () => {
    expect(isLive(promo(), new Date('2026-11-01T00:00:00Z'))).toBe(true);
    expect(isLive(promo(), new Date('2026-11-10T00:00:00Z'))).toBe(false);
    expect(isLive(promo(), new Date('2026-10-31T23:59:59Z'))).toBe(false);
  });
  it('الموقوف مش ساري', () => {
    expect(isLive(promo({ isActive: false }), NOW)).toBe(false);
  });
  it('الحالات', () => {
    expect(promotionState(promo(), NOW)).toBe('live');
    expect(promotionState(promo({ startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-05T00:00:00Z' }), NOW)).toBe('upcoming');
    expect(promotionState(promo({ endsAt: '2026-11-02T00:00:00Z' }), NOW)).toBe('ended');
    expect(promotionState(promo({ isActive: false, endsAt: '2026-11-02T00:00:00Z' }), NOW)).toBe('paused');
  });
});

describe('bestPromotion / effectivePrice', () => {
  it('الأقل سعرًا يكسب', () => {
    const list = [
      promo({ id: 'a', kind: 'percent', value: 10 }),
      promo({ id: 'b', kind: 'sale_price', value: 150 }),
    ];
    expect(effectivePrice(list, 'product_printed', 'prod-1', 200, NOW)).toBe(150);
  });
  it('هدف تاني أو نوع تاني ما بيتأثرش', () => {
    const list = [promo()];
    expect(effectivePrice(list, 'product_printed', 'prod-2', 200, NOW)).toBe(200);
    expect(effectivePrice(list, 'product_electronic', 'prod-1', 200, NOW)).toBe(200);
  });
  it('عرض منتهي أو قادم ما بيتطبقش', () => {
    expect(effectivePrice([promo({ endsAt: '2026-11-02T00:00:00Z' })], 'product_printed', 'prod-1', 200, NOW)).toBe(200);
  });
  it('عرض مابيخفّضش = مفيش عرض', () => {
    expect(bestPromotion([promo({ kind: 'sale_price', value: 500 })], 'product_printed', 'prod-1', 200, NOW)).toBeNull();
  });
  it('تعادل: اللي بينتهي أبكر', () => {
    const list = [
      promo({ id: 'late', kind: 'sale_price', value: 150, endsAt: '2026-11-20T00:00:00Z' }),
      promo({ id: 'soon', kind: 'sale_price', value: 150, endsAt: '2026-11-08T00:00:00Z' }),
    ];
    expect(bestPromotion(list, 'product_printed', 'prod-1', 200, NOW)?.endsAt).toBe('2026-11-08T00:00:00Z');
  });
});

describe('savingsPercent', () => {
  it('نسبة التوفير', () => {
    expect(savingsPercent(200, 150)).toBe(25);
    expect(savingsPercent(200, 200)).toBe(0);
    expect(savingsPercent(0, 0)).toBe(0);
  });
});

describe('apply*', () => {
  it('منتج: المطبوع والإلكتروني كل واحد بعرضه', () => {
    const product = { id: 'prod-1', price: 200, electronicPrice: 100 };
    const out = applyProductPromotions(
      product,
      [promo(), promo({ id: 'e', targetType: 'product_electronic', kind: 'sale_price', value: 60 })],
      NOW,
    );
    expect(out.price).toBe(160);
    expect(out.listPrice).toBe(200);
    expect(out.electronicPrice).toBe(60);
    expect(out.electronicListPrice).toBe(100);
    expect(out.saleEndsAt).toBe('2026-11-10T00:00:00Z');
    expect(product.price).toBe(200); // الأصل ما اتغيّرش
  });
  it('منتج من غير عرض بيرجع زي ما هو', () => {
    const product = { id: 'prod-9', price: 200 };
    expect(applyProductPromotions(product, [promo()], NOW)).toBe(product);
  });
  it('إضافة', () => {
    const out = applyAddonPromotions(
      { id: 'a1', price: 100 },
      [promo({ targetType: 'addon', targetId: 'a1', value: 50 })],
      NOW,
    );
    expect(out.price).toBe(50);
    expect(out.listPrice).toBe(100);
  });
  it('خطة صندوق: الإجمالي والشهري', () => {
    const out = applyBoxPlanPromotions(
      { id: 'plan-3', priceTotal: 900, priceMonthly: 300, durationMonths: 3 },
      [promo({ targetType: 'box_plan', targetId: 'plan-3', value: 10 })],
      NOW,
    );
    expect(out.priceTotal).toBe(810);
    expect(out.priceMonthly).toBe(270);
    expect(out.listPrice).toBe(900);
    expect(out.listPriceMonthly).toBe(300);
  });
});

describe('validatePromotion', () => {
  const base = {
    targetType: 'product_printed',
    targetId: 'prod-1',
    kind: 'percent',
    value: 20,
    label: '  عرض الإطلاق ',
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: '2026-11-10T00:00:00Z',
  };
  it('مدخل سليم', () => {
    const r = validatePromotion(base, 200);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.label).toBe('عرض الإطلاق');
  });
  it('نسبة ١٠٠ أو أكتر', () => {
    expect(validatePromotion({ ...base, value: 100 }, 200).ok).toBe(false);
  });
  it('سعر عرض مش أقل من الأصل', () => {
    expect(validatePromotion({ ...base, kind: 'sale_price', value: 200 }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, kind: 'sale_price', value: 199 }, 200).ok).toBe(true);
  });
  it('قيمة كسرية أو صفر أو سالبة', () => {
    expect(validatePromotion({ ...base, value: 12.5 }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, value: 0 }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, value: -5 }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, value: Number.NaN }, 200).ok).toBe(false);
  });
  it('النهاية قبل البداية', () => {
    expect(validatePromotion({ ...base, endsAt: '2026-10-01T00:00:00Z' }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, endsAt: base.startsAt }, 200).ok).toBe(false);
  });
  it('نوع أو هدف غلط وعنوان طويل', () => {
    expect(validatePromotion({ ...base, targetType: 'x' }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, targetId: ' ' }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, kind: 'x' }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, label: 'ا'.repeat(61) }, 200).ok).toBe(false);
    expect(validatePromotion({ ...base, startsAt: 'nope' }, 200).ok).toBe(false);
  });
});

describe('توقيت القاهرة', () => {
  it('الشتاء UTC+2', () => {
    expect(cairoLocalToIso('2026-11-01T12:00')).toBe('2026-11-01T10:00:00.000Z');
    expect(isoToCairoLocal('2026-11-01T10:00:00.000Z')).toBe('2026-11-01T12:00');
  });
  it('رجوع ذهابًا وإيابًا', () => {
    const iso = cairoLocalToIso('2026-12-25T23:30');
    expect(iso).not.toBeNull();
    expect(isoToCairoLocal(iso as string)).toBe('2026-12-25T23:30');
  });
  it('صيغة غلط', () => {
    expect(cairoLocalToIso('2026-11-01')).toBeNull();
    expect(cairoLocalToIso('')).toBeNull();
  });
});
