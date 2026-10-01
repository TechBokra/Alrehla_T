import { describe, it, expect } from 'vitest';
import { normalizeCancelDays, staleCutoff, DEFAULT_PENDING_CANCEL_DAYS } from './stale-orders';

describe('stale-orders', () => {
  it('الإعداد: فاضي = ٧ · صفر = مقفول · سقف ٦٠', () => {
    expect(normalizeCancelDays(undefined)).toBe(DEFAULT_PENDING_CANCEL_DAYS);
    expect(normalizeCancelDays('')).toBe(7);
    expect(normalizeCancelDays(0)).toBe(0);
    expect(normalizeCancelDays('3')).toBe(3);
    expect(normalizeCancelDays(500)).toBe(60);
    expect(normalizeCancelDays(-2)).toBe(7);
    expect(normalizeCancelDays('x')).toBe(7);
  });
  it('الحد الزمني', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(staleCutoff(now, 7)?.toISOString()).toBe('2026-10-03T12:00:00.000Z');
    expect(staleCutoff(now, 0)).toBeNull();
  });
});
