import type { Database } from '@/types/supabase';
import type { BoxShipment, BoxSubscription } from '@/types';
import { createClient } from '@/lib/supabase/server';

type SubRow = Database['public']['Tables']['box_subscriptions']['Row'];

type ShipRow = Database['public']['Tables']['box_shipments']['Row'];

const SHIP_STATUSES: BoxShipment['status'][] = ['pending', 'preparing', 'shipped', 'delivered'];

export function mapShipment(r: ShipRow): BoxShipment {
  return {
    id: r.id,
    monthNumber: r.month_number,
    goal: r.goal ?? undefined,
    status: (SHIP_STATUSES as string[]).includes(r.status) ? (r.status as BoxShipment['status']) : 'pending',
    trackingReference: r.tracking_reference ?? undefined,
    shippedAt: r.shipped_at ?? undefined,
    deliveredAt: r.delivered_at ?? undefined,
  };
}

function mapSubscription(sub: SubRow, shipments?: ShipRow[]): BoxSubscription {
  return {
    id: sub.id,
    userId: sub.user_id ?? undefined,
    customerName: sub.customer_name,
    planName: sub.plan_name,
    status: sub.status,
    // ⚠️ كانت `|| new Date()` — اشتراك من غير موعد كان بيتعرض «النهارده».
    nextShipmentDate: sub.next_shipment_date ?? '',
    orderId: sub.order_id ?? undefined,
    months: sub.months ?? undefined,
    startsAt: sub.starts_at ?? undefined,
    endsAt: sub.ends_at ?? undefined,
    addonDiscountPercent: sub.addon_discount_percent ?? 0,
    freeAddonName: sub.free_addon_name ?? undefined,
    details: (sub.details as Record<string, unknown> | null) ?? undefined,
    shipments: shipments
      ?.filter((s) => s.subscription_id === sub.id)
      .sort((a, b) => a.month_number - b.month_number)
      .map(mapShipment),
  };
}

export async function withShipments(subs: SubRow[]): Promise<BoxSubscription[]> {
  if (subs.length === 0) return [];
  const supabase = await createClient();
  const { data: ships } = await supabase
    .from('box_shipments')
    .select('*')
    .in('subscription_id', subs.map((s) => s.id));
  return subs.map((s) => mapSubscription(s, ships ?? []));
}
