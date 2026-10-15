import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GATEWAY_DOWN_MESSAGE,
  DEFAULT_PAYMENT_SETTINGS,
  parsePaymentSettings,
  paymentAvailability,
  validatePaymentSettings,
} from './settings';

describe('parsePaymentSettings', () => {
  it('reads a complete row', () => {
    expect(
      parsePaymentSettings({
        provider: 'xpay',
        methods: ['card', 'valu'],
        feesPassThrough: true,
        gatewayDownMessage: '  الدفع متوقف  ',
      }),
    ).toEqual({
      provider: 'xpay',
      methods: ['card', 'valu'],
      feesPassThrough: true,
      gatewayDownMessage: 'الدفع متوقف',
    });
  });

  it('falls back to manual for anything unreadable', () => {
    for (const bad of [null, undefined, 'xpay', 42, []]) {
      expect(parsePaymentSettings(bad)).toEqual(DEFAULT_PAYMENT_SETTINGS);
    }
  });

  it('treats an unknown provider as manual, never as the gateway', () => {
    expect(parsePaymentSettings({ provider: 'paymob' }).provider).toBe('manual');
    expect(parsePaymentSettings({ provider: 'XPAY' }).provider).toBe('manual');
  });

  it('drops unknown methods and de-duplicates the rest', () => {
    expect(parsePaymentSettings({ methods: ['card', 'bitcoin', 'card', 'fawry'] }).methods).toEqual([
      'card',
      'fawry',
    ]);
  });

  it('never leaves the gateway without a method', () => {
    expect(parsePaymentSettings({ provider: 'xpay', methods: [] }).methods).toEqual(['card']);
    expect(parsePaymentSettings({ provider: 'xpay', methods: ['nope'] }).methods).toEqual(['card']);
  });

  it('only treats an explicit true as fee pass-through', () => {
    expect(parsePaymentSettings({ feesPassThrough: 'yes' }).feesPassThrough).toBe(false);
    expect(parsePaymentSettings({ feesPassThrough: 1 }).feesPassThrough).toBe(false);
    expect(parsePaymentSettings({ feesPassThrough: true }).feesPassThrough).toBe(true);
  });
});

describe('paymentAvailability', () => {
  const gateway = parsePaymentSettings({ provider: 'xpay', methods: ['card', 'fawry'] });
  const manual = DEFAULT_PAYMENT_SETTINGS;

  it('shows the gateway only when it is both enabled and configured', () => {
    expect(paymentAvailability(gateway, true)).toEqual({ mode: 'gateway', methods: ['card', 'fawry'] });
  });

  it('falls back to manual when the server keys are missing, with a notice', () => {
    expect(paymentAvailability(gateway, false)).toEqual({
      mode: 'manual',
      notice: DEFAULT_GATEWAY_DOWN_MESSAGE,
    });
  });

  it('uses the admin message when one is set', () => {
    const withMessage = parsePaymentSettings({
      provider: 'xpay',
      methods: ['card'],
      gatewayDownMessage: 'عطل مؤقت لدى البنك',
    });
    expect(paymentAvailability(withMessage, false)).toMatchObject({ notice: 'عطل مؤقت لدى البنك' });
  });

  it('shows no notice when manual is the deliberate choice', () => {
    expect(paymentAvailability(manual, true)).toEqual({ mode: 'manual', notice: '' });
    expect(paymentAvailability(manual, false)).toEqual({ mode: 'manual', notice: '' });
  });
});

describe('validatePaymentSettings', () => {
  it('refuses to enable the gateway with no method', () => {
    expect(
      validatePaymentSettings({
        provider: 'xpay',
        methods: [],
        feesPassThrough: false,
        gatewayDownMessage: '',
      }),
    ).toMatchObject({ field: 'methods' });
  });

  it('allows manual with no method', () => {
    expect(
      validatePaymentSettings({
        provider: 'manual',
        methods: [],
        feesPassThrough: false,
        gatewayDownMessage: '',
      }),
    ).toBeNull();
  });

  it('caps the notice length', () => {
    expect(
      validatePaymentSettings({
        provider: 'manual',
        methods: ['card'],
        feesPassThrough: false,
        gatewayDownMessage: 'ا'.repeat(301),
      }),
    ).toMatchObject({ field: 'gatewayDownMessage' });
  });
});
