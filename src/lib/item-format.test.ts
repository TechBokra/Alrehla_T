import { describe, it, expect } from 'vitest';
import {
  electronicAvailable, basePriceForFormat, isQuantityLocked, itemNeedsShipping,
  cartNeedsShipping, cartHasElectronic, isValidDeliveryEmail, isItemFormat,
} from './item-format';

describe('item-format — نفس قواعد ملف 138', () => {
  it('الإلكتروني لـ«مخصص» بسعر بس', () => {
    expect(electronicAvailable({ category: 'custom', electronicPrice: 200 })).toBe(true);
    expect(electronicAvailable({ category: 'library', electronicPrice: 200 })).toBe(false);
    expect(electronicAvailable({ category: 'custom', electronicPrice: 0 })).toBe(false);
    expect(electronicAvailable({ category: 'custom' })).toBe(false);
  });

  it('السعر حسب النوع', () => {
    const p = { price: 500, electronicPrice: 200 };
    expect(basePriceForFormat(p, 'printed')).toBe(500);
    expect(basePriceForFormat(p, 'electronic')).toBe(200);
    expect(basePriceForFormat(p, 'both')).toBe(700);
  });

  it('الشحن: مطبوع أو إضافة — والإلكتروني لوحده لأ', () => {
    expect(itemNeedsShipping({ format: 'electronic' })).toBe(false);
    expect(itemNeedsShipping({ format: 'electronic', addonIds: ['a1'] })).toBe(true);
    expect(itemNeedsShipping({ format: 'both' })).toBe(true);
    expect(itemNeedsShipping({})).toBe(true); // سلة قديمة من غير نوع = مطبوع
    expect(itemNeedsShipping({ type: 'subscription' })).toBe(false);
    expect(cartNeedsShipping([{ format: 'electronic' }, { format: 'electronic' }])).toBe(false);
    expect(cartNeedsShipping([{ format: 'electronic' }, {}])).toBe(true);
  });

  it('الكمية مقفولة للإلكتروني والاتنين', () => {
    expect(isQuantityLocked('electronic')).toBe(true);
    expect(isQuantityLocked('both')).toBe(true);
    expect(isQuantityLocked('printed')).toBe(false);
    expect(isQuantityLocked(undefined)).toBe(false);
    expect(cartHasElectronic([{}, { format: 'both' }])).toBe(true);
    expect(cartHasElectronic([{ format: 'printed' }])).toBe(false);
  });

  it('الإيميل والنوع', () => {
    expect(isValidDeliveryEmail(' a@b.com ')).toBe(true);
    expect(isValidDeliveryEmail('nope')).toBe(false);
    expect(isValidDeliveryEmail('a@b')).toBe(false);
    expect(isItemFormat('both')).toBe(true);
    expect(isItemFormat('pdf')).toBe(false);
  });
});

import { addonsDisplayTotal } from './item-format';
describe('addonsDisplayTotal', () => {
  it('المختار بس، وفرق التخصيص للمخصّصة بس', () => {
    const addons = [
      { id: 'a', price: 120, customizationPrice: 30 },
      { id: 'b', price: 50, customizationPrice: 10 },
    ];
    expect(addonsDisplayTotal(addons, ['a'], [])).toBe(120);
    expect(addonsDisplayTotal(addons, ['a', 'b'], ['a'])).toBe(200);
    expect(addonsDisplayTotal(addons, [], ['a'])).toBe(0);
  });
});
