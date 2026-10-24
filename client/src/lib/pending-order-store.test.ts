import { describe, expect, it } from 'vitest';
import { cartSignature, paidItemIds, resumableFor, PENDING_ORDER_TTL_MS } from './pending-order-store';

const items = [{ id: 'a', productId: 'p', format: 'electronic', addonIds: ['x'] }];
const pending = { orderId: 'o1', reference: 'R-1', total: 900, signature: cartSignature(items), at: 1_000 };

describe('resumableFor', () => {
  it('نفس السلة وفي خلال يوم = يتعرض', () => {
    expect(resumableFor(pending, items, 2_000)).toEqual(pending);
  });

  it('⚠️ السلة اتغيّرت (إضافة اتشالت) = لأ — الطلب المسجّل مابقاش هو', () => {
    expect(resumableFor(pending, [{ ...items[0], addonIds: [] }], 2_000)).toBeNull();
  });

  it('أقدم من يوم = لأ', () => {
    expect(resumableFor(pending, items, 1_000 + PENDING_ORDER_TTL_MS + 1)).toBeNull();
  });

  it('سلة فاضية أو مفيش طلب محفوظ = لأ', () => {
    expect(resumableFor(pending, [], 2_000)).toBeNull();
    expect(resumableFor(null, items, 2_000)).toBeNull();
  });
});

describe('paidItemIds', () => {
  it('⚠️ بيشيل بنود الطلب بس — اللي اتضاف بعد كده بيفضل', () => {
    const p = { ...pending, itemIds: ['a'] };
    expect(paidItemIds(p, [{ id: 'a' }, { id: 'new' }])).toEqual(['a']);
  });
  it('من غير أرقام: السلة كلها بس لو لسه هي هي', () => {
    expect(paidItemIds(pending, items)).toEqual(['a']);
    expect(paidItemIds(pending, [{ id: 'a' }, { id: 'new' }])).toEqual([]);
  });
});
