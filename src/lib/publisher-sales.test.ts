import { describe, it, expect } from 'vitest';
import { sharePerUnit, salesTotals, isPaidStatus } from './publisher-sales';

describe('publisher-sales', () => {
  it('النصيب المتثبّت وقت الشراء أولًا', () => {
    expect(sharePerUnit({ snapshot: 120, currentCost: 200, unitPrice: 500, fixedAdminFee: 20, multiplier: 2 })).toBe(120);
    expect(sharePerUnit({ snapshot: null, currentCost: 200, unitPrice: 500, fixedAdminFee: 20, multiplier: 2 })).toBe(200);
    expect(sharePerUnit({ snapshot: null, currentCost: null, unitPrice: 500, fixedAdminFee: 20, multiplier: 2 })).toBe(240);
    expect(sharePerUnit({ snapshot: 0, currentCost: 0, unitPrice: 10, fixedAdminFee: 20, multiplier: 2 })).toBe(0);
  });
  it('الأرباح من المدفوع بس — «بانتظار الدفع» والملغي برّه', () => {
    const t = salesTotals([
      { status: 'pending', totalAmount: 500, publisherShare: 200 },
      { status: 'awaiting_verification', totalAmount: 500, publisherShare: 200 },
      { status: 'paid', totalAmount: 300, publisherShare: 100 },
      { status: 'delivered', totalAmount: 300, publisherShare: 100 },
      { status: 'cancelled', totalAmount: 900, publisherShare: 400 },
    ]);
    expect(t).toEqual({ paidCount: 2, sales: 600, earnings: 200, awaitingCount: 2 });
  });
  it('مفيش حالة اسمها completed — كانت الشرط اللي بيحط كله «قيد الانتظار»', () => {
    expect(isPaidStatus('completed')).toBe(false);
    expect(isPaidStatus('shipped')).toBe(true);
  });
});
