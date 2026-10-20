import { describe, it, expect } from 'vitest';
import { parseStoredCart, serializeCart, MAX_AGE_MS } from './cart-storage';

const line = { id: 'a', productId: 'p1', name: 'كتاب', price: 630, quantity: 1, type: 'book' };
const NOW = 1_800_000_000_000;

describe('حفظ السلة', () => {
  it('اللي اتحفظ بيرجع زي ما هو', () => {
    expect(parseStoredCart(serializeCart([line], NOW), NOW)).toEqual([line]);
  });

  it('⚠️ الأقدم من أسبوع بيتشال — جهاز عائلة مشترك', () => {
    const old = serializeCart([line], NOW - MAX_AGE_MS - 1);
    expect(parseStoredCart(old, NOW)).toEqual([]);
  });

  it('المحفوظ التالف أو الفاضي = سلة فاضية، مش خطأ', () => {
    expect(parseStoredCart(null, NOW)).toEqual([]);
    expect(parseStoredCart('{كلام', NOW)).toEqual([]);
    expect(parseStoredCart('[]', NOW)).toEqual([]);
  });

  it('السطر التالف بيتشال لوحده والباقي بيفضل', () => {
    const raw = JSON.stringify({
      savedAt: NOW,
      items: [line, { id: 'b', name: 'ناقص رقم المنتج', price: 1, quantity: 1 }, { ...line, id: 'c', quantity: 0 }],
    });
    expect(parseStoredCart<{ id: string }>(raw, NOW).map((x) => x.id)).toEqual(['a']);
  });

  it('تاريخ في المستقبل = متلاعب فيه، بيتشال', () => {
    expect(parseStoredCart(serializeCart([line], NOW + 3_600_000), NOW)).toEqual([]);
  });
});
