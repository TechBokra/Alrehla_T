import { describe, it, expect, vi } from 'vitest';
import {
  cancelStalePendingOrders,
  deliverStaleOrderNotifications,
  normalizeCancelDays,
  staleCutoff,
  DEFAULT_PENDING_CANCEL_DAYS,
} from './stale-orders';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

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

  it('disables cancellation without making a database call', async () => {
    const rpc = vi.fn();
    const result = await cancelStalePendingOrders({ rpc } as unknown as SupabaseClient<Database>, 0);
    expect(result).toEqual({ ok: true, cancelled: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls the atomic cancellation function with the configured age and clock', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    const now = new Date('2026-10-10T12:00:00Z');
    const result = await cancelStalePendingOrders({ rpc } as unknown as SupabaseClient<Database>, 7, now);
    expect(result).toEqual({ ok: true, cancelled: 3 });
    expect(rpc).toHaveBeenCalledWith('cancel_stale_pending_orders', {
      p_days: 7,
      p_now: now.toISOString(),
    });
  });

  it('surfaces cancellation failures so the scheduled job reports them', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'database unavailable' } });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await cancelStalePendingOrders({ rpc } as unknown as SupabaseClient<Database>, 7);
    expect(result).toEqual({ ok: false, error: 'database unavailable' });
    errorLog.mockRestore();
  });

  it('returns delivery counters from the retry function', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ delivered_count: 4, failed_count: 1, pending_count: 1 }],
      error: null,
    });
    const result = await deliverStaleOrderNotifications({ rpc } as unknown as SupabaseClient<Database>);
    expect(result).toEqual({ delivered: 4, failed: 1, pending: 1 });
    expect(rpc).toHaveBeenCalledWith('deliver_stale_order_notifications', { p_limit: 1000 });
  });
});
