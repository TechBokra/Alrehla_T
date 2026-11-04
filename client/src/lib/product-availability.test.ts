import { describe, expect, it } from 'vitest';
import { productUnavailableReason, shipsOnly } from './product-availability';

const paused = { paused: true, message: '' };
const open = { paused: false, message: '' };

describe('productUnavailableReason', () => {
  it('كتاب المكتبة والتوصيل متوقف = مش متاح، والسبب ماقالش «اطلب الإلكترونية» (مفيش)', () => {
    const r = productUnavailableReason({ category: 'library', electronicPrice: 0 }, paused);
    expect(r).toBeTruthy();
    expect(r).not.toContain('الإلكترونية');
  });

  it('قصة ليها نسخة إلكترونية = متاحة حتى والتوصيل متوقف', () => {
    expect(productUnavailableReason({ category: 'custom', electronicPrice: 450 }, paused)).toBeNull();
  });

  it('قصة مطبوعة بس = مش متاحة والتوصيل متوقف، ومتاحة لما يفتح', () => {
    expect(shipsOnly({ category: 'custom', electronicPrice: 0 })).toBe(true);
    expect(productUnavailableReason({ category: 'custom' }, paused)).toBeTruthy();
    expect(productUnavailableReason({ category: 'custom' }, open)).toBeNull();
  });

  it('رسالة الإدارة بتتعرض زي ما هي', () => {
    expect(productUnavailableReason({ category: 'library' }, { paused: true, message: 'موقفين الشحن لحد العيد' })).toBe(
      'موقفين الشحن لحد العيد',
    );
  });
});
