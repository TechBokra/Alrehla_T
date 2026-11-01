import { describe, it, expect } from 'vitest';
import { isGatewayPayment, paymentState } from './payment-view';

describe('paymentState', () => {
  it('⚠️ ALR-000069-RF: فيزا عن طريق XPay ومدفوع ← مش «لسه ما اترفعش إيصال»', () => {
    const s = paymentState({ provider: 'xpay', method: 'card', status: 'paid', hasReceipt: false, paidAt: '2026-10-27T17:18:51Z' });
    expect(s.kind).toBe('gateway_paid');
    expect(s.text).not.toMatch(/إيصال —/);
  });
  it('بوابة ولسه ماتدفعش', () => {
    expect(paymentState({ provider: 'xpay', method: null, status: 'pending', hasReceipt: false }).kind).toBe('gateway_waiting');
  });
  it('تحويل يدوي: إيصال مستني، ومن غير إيصال، واتأكد', () => {
    expect(paymentState({ provider: 'manual', method: 'instapay', status: 'awaiting_verification', hasReceipt: true }).kind).toBe('receipt_review');
    expect(paymentState({ provider: 'manual', method: null, status: 'pending', hasReceipt: false }).kind).toBe('awaiting_transfer');
    expect(paymentState({ provider: 'manual', method: 'instapay', status: 'delivered', hasReceipt: true }).kind).toBe('receipt_confirmed');
  });
  it('ملغي', () => {
    expect(paymentState({ provider: 'xpay', method: 'card', status: 'cancelled', hasReceipt: false }).kind).toBe('cancelled');
  });
  it('من غير مزوّد مسجّل: الوسيلة بتحدد', () => {
    expect(isGatewayPayment({ method: 'card' })).toBe(true);
    expect(isGatewayPayment({ method: 'instapay' })).toBe(false);
  });
});
