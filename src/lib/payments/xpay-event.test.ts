import { describe, expect, it } from 'vitest';
import { isHandledEvent, parseXpayEvent } from './xpay-event';

const ORDER = '3f2a1b4c-5d6e-4f7a-8b9c-0d1e2f3a4b5c';

const completed = {
  id: 'evt_123',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_abc',
      object: 'checkout.session',
      amountTotal: 25000,
      currency: 'EGP',
      livemode: false,
      paymentIntentId: 'pi_abc',
      paymentMethodType: 'card',
      metadata: { orderId: ORDER },
    },
  },
};

describe('parseXpayEvent', () => {
  it('reads a completed checkout session', () => {
    expect(parseXpayEvent(completed)).toEqual({
      id: 'evt_123',
      type: 'checkout.session.completed',
      // جلسة من غير `metadata.kind` = طلب منتج — السلوك اللي كان
      // الوحيد قبل ما «بداية الرحلة» تتربط بالبوابة.
      kind: 'order',
      orderId: ORDER,
      sessionId: 'cs_abc',
      intentId: 'pi_abc',
      amountMinor: 25000,
      currency: 'EGP',
      method: 'card',
      livemode: false,
    });
  });

  /**
   * ⚠️ `kind` بتقرّر **أنهي جدول** بيتسجّل فيه الدفع: طلب منتج، خدمة
   *    كتابة، ولا حجز باقة. قراءة غلط هنا معناها دفعة بتتسجّل على
   *    الصف الغلط — أو ماتتسجّلش خالص والعميل يكون دفع.
   */
  it('reads the payment kind from the session metadata', () => {
    const forService = {
      ...completed,
      data: {
        object: {
          ...completed.data.object,
          metadata: { orderId: ORDER, kind: 'service_order' },
        },
      },
    };
    expect(parseXpayEvent(forService)?.kind).toBe('service_order');

    const forBooking = {
      ...completed,
      data: {
        object: {
          ...completed.data.object,
          metadata: { orderId: ORDER, kind: 'course_subscription' },
        },
      },
    };
    expect(parseXpayEvent(forBooking)?.kind).toBe('course_subscription');
  });

  it('treats a missing or unknown kind as a product order', () => {
    // جلسة اتفتحت قبل ما الخانة دي تتعرّف لازم تفضل تتعالج زي الأول،
    // مش تتجاهَل والعميل يكون دفع.
    expect(parseXpayEvent(completed)?.kind).toBe('order');

    const odd = {
      ...completed,
      data: {
        object: { ...completed.data.object, metadata: { orderId: ORDER, kind: 'نجمة' } },
      },
    };
    expect(parseXpayEvent(odd)?.kind).toBe('order');
  });

  it('rejects a payload with no event id or type', () => {
    expect(parseXpayEvent({ type: 'x' })).toBeNull();
    expect(parseXpayEvent({ id: 'evt' })).toBeNull();
    expect(parseXpayEvent(null)).toBeNull();
    expect(parseXpayEvent('evt_1')).toBeNull();
    expect(parseXpayEvent([])).toBeNull();
  });

  it('refuses an order id that is not a UUID, rather than passing it on', () => {
    for (const bad of ['../../etc', '1 OR 1=1', 'order-7', '']) {
      const event = { ...completed, data: { object: { ...completed.data.object, metadata: { orderId: bad } } } };
      expect(parseXpayEvent(event)?.orderId).toBeNull();
    }
  });

  it('accepts snake_case metadata and lowercases the id', () => {
    const event = {
      ...completed,
      data: { object: { ...completed.data.object, metadata: { order_id: ORDER.toUpperCase() } } },
    };
    expect(parseXpayEvent(event)?.orderId).toBe(ORDER.toLowerCase());
  });

  it('reads an amount sent as a numeric string', () => {
    const event = { ...completed, data: { object: { ...completed.data.object, amountTotal: '25000' } } };
    expect(parseXpayEvent(event)?.amountMinor).toBe(25000);
  });

  it('ignores a negative, fractional or non-numeric amount', () => {
    for (const bad of [-100, 12.5, 'abc', null, {}]) {
      const event = { ...completed, data: { object: { ...completed.data.object, amountTotal: bad } } };
      expect(parseXpayEvent(event)?.amountMinor).toBeNull();
    }
  });

  it('falls back to the payment intent for the amount and id', () => {
    const event = {
      id: 'evt_9',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_z',
          metadata: { orderId: ORDER },
          paymentIntent: { id: 'pi_z', amount: 9900, paymentMethodType: 'fawry_pay' },
        },
      },
    };
    expect(parseXpayEvent(event)).toMatchObject({ intentId: 'pi_z', amountMinor: 9900, method: 'fawry' });
  });

  it('normalises method names and returns null for unknown ones', () => {
    const method = (v: unknown) =>
      parseXpayEvent({ ...completed, data: { object: { ...completed.data.object, paymentMethodType: v } } })?.method;
    expect(method('VISA')).toBe('card');
    expect(method('credit_card')).toBe('card');
    expect(method('valu_installments')).toBe('valu');
    expect(method('vodafone_cash')).toBe('wallet');
    expect(method('bitcoin')).toBeNull();
    expect(method(undefined)).toBeNull();
  });

  it('reads a flat payload that has no data.object wrapper', () => {
    expect(
      parseXpayEvent({
        id: 'evt_flat',
        type: 'checkout.session.completed',
        amountTotal: 500,
        paymentIntentId: 'pi_flat',
        metadata: { orderId: ORDER },
      }),
    ).toMatchObject({ orderId: ORDER, intentId: 'pi_flat', amountMinor: 500 });
  });
});

describe('isHandledEvent', () => {
  it('covers completion, expiry and failure only', () => {
    expect(isHandledEvent('checkout.session.completed')).toBe(true);
    expect(isHandledEvent('checkout.session.expired')).toBe(true);
    expect(isHandledEvent('payment_intent.payment_failed')).toBe(true);
    expect(isHandledEvent('charge.refunded')).toBe(false);
    expect(isHandledEvent('')).toBe(false);
  });
});
