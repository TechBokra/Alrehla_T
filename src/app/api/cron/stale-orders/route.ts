import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { cancelStalePendingOrders, deliverStaleOrderNotifications } from '@/lib/stale-orders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * المهمة اليومية: إلغاء الطلبات اللي مااتدفعتش (`@/lib/stale-orders`).
 *
 * Cancels stale unpaid orders and retries pending cancellation notices.
 * The cancellation and its notification intent are committed atomically by
 * Postgres; notification delivery is retried independently on later runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('stale-orders cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isAdminApiConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY غير موجود على الخادم' }, { status: 503 });
  }

  const supabase = createAdminClient();
  let days = 0;
  let cancelled = 0;
  let cancellationError: string | null = null;

  try {
    ({ pendingOrderCancelDays: days } = await getSiteSettings());
    const result = await cancelStalePendingOrders(supabase, days);
    if (result.ok) cancelled = result.cancelled;
    else cancellationError = result.error;
  } catch (error) {
    cancellationError = error instanceof Error ? error.message : 'Failed to cancel stale orders.';
  }

  let delivery: { delivered: number; failed: number; pending: number } | null = null;
  let deliveryError: string | null = null;
  try {
    delivery = await deliverStaleOrderNotifications(supabase);
  } catch (error) {
    deliveryError = error instanceof Error ? error.message : 'Failed to deliver stale-order notifications.';
  }

  const body = {
    days,
    cancelled,
    delivered: delivery?.delivered ?? 0,
    failed: delivery?.failed ?? 0,
    pending: delivery?.pending ?? 0,
    ...(cancellationError ? { cancellationError } : {}),
    ...(deliveryError ? { deliveryError } : {}),
  };
  if (cancellationError || deliveryError || (delivery?.failed ?? 0) > 0) {
    return NextResponse.json(body, { status: 500 });
  }
  return NextResponse.json(body);
}
