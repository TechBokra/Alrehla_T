import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Orders are registered before the customer uploads a receipt. Expire only
 * pending orders with no receipt, and record the notification in the same
 * database transaction as the status change.
 */

export const DEFAULT_PENDING_CANCEL_DAYS = 7;
export const MAX_PENDING_CANCEL_DAYS = 60;

/** Empty/invalid = default; zero disables cancellation; positive values cap at 60. */
export function normalizeCancelDays(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PENDING_CANCEL_DAYS;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PENDING_CANCEL_DAYS;
  return Math.min(n, MAX_PENDING_CANCEL_DAYS);
}

/** Orders older than this instant are eligible; null means cancellation is disabled. */
export function staleCutoff(now: Date, days: number): Date | null {
  if (days <= 0) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export type StaleOrderCancellationResult =
  | { ok: true; cancelled: number }
  | { ok: false; error: string };

/** Atomically cancels eligible orders and inserts their durable notification intents. */
export async function cancelStalePendingOrders(
  supabase: SupabaseClient<Database>,
  days: number,
  now = new Date(),
): Promise<StaleOrderCancellationResult> {
  if (days <= 0) return { ok: true, cancelled: 0 };

  const { data, error } = await supabase.rpc('cancel_stale_pending_orders', {
    p_days: days,
    p_now: now.toISOString(),
  });

  if (error) {
    console.error('Error cancelling stale orders', error);
    return { ok: false, error: error.message };
  }
  if (typeof data !== 'number') {
    return { ok: false, error: 'Stale-order cancellation returned an invalid result.' };
  }
  return { ok: true, cancelled: data };
}

export type StaleOrderNotificationDelivery = {
  delivered: number;
  failed: number;
  pending: number;
};

/** Deliver up to 1,000 durable cancellation notices; undelivered rows remain retryable. */
export async function deliverStaleOrderNotifications(
  supabase: SupabaseClient<Database>,
): Promise<StaleOrderNotificationDelivery> {
  const { data, error } = await supabase.rpc('deliver_stale_order_notifications', {
    p_limit: 1000,
  });
  if (error) throw error;

  const result = data?.[0];
  if (!result) throw new Error('Stale-order notification delivery returned no result.');
  return {
    delivered: result.delivered_count,
    failed: result.failed_count,
    pending: result.pending_count,
  };
}
