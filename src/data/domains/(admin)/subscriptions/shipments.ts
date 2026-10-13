import { createClient } from '@/lib/supabase/server';
import { isDueThisMonth, shipmentDueDate } from '@/lib/box-schedule';
import type { DueBoxShipment } from '@/data/domains/(shared)/subscriptions/types';
import { mapShipment } from '@/data/domains/(shared)/subscriptions/subscriptions-internal';

/**
 * كل الصناديق اللي موعدها جه أو هييجي قبل آخر الشهر — من كل الاشتراكات
 * النشطة، في شاشة واحدة لفريق التجهيز (بدل ما يفتح كل اشتراك لوحده).
 */
export const getDueBoxShipments = async (now = new Date()): Promise<DueBoxShipment[]> => {
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from('box_subscriptions')
    .select('*')
    .eq('status', 'active')
    .not('starts_at', 'is', null);
  if (!subs || subs.length === 0) return [];

  const { data: ships } = await supabase
    .from('box_shipments')
    .select('*')
    .in('subscription_id', subs.map((s) => s.id))
    .in('status', ['pending', 'preparing']);

  const orderIds = subs.map((s) => s.order_id).filter((x): x is string => Boolean(x));
  const { data: orders } = orderIds.length
    ? await supabase
        .from('orders')
        .select('id, recipient_name, recipient_phone, address_line, city, governorate')
        .in('id', orderIds)
    : { data: [] };
  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));
  const subById = new Map(subs.map((s) => [s.id, s]));
  const today = now.getTime();

  const rows: DueBoxShipment[] = [];
  for (const sh of ships ?? []) {
    const sub = subById.get(sh.subscription_id);
    if (!sub?.starts_at || !isDueThisMonth(sub.starts_at, sh.month_number, now)) continue;
    const due = shipmentDueDate(sub.starts_at, sh.month_number);
    const order = sub.order_id ? orderById.get(sub.order_id) : undefined;
    const details = (sub.details ?? {}) as Record<string, unknown>;
    rows.push({
      shipment: mapShipment(sh),
      subscriptionId: sub.id,
      planName: sub.plan_name,
      months: sub.months ?? 0,
      childName: typeof details.childName === 'string' ? details.childName : undefined,
      freeAddonName: sub.free_addon_name ?? undefined,
      dueDate: due.toISOString(),
      overdue: due.getTime() < today && sh.status === 'pending',
      recipient: order
        ? {
            name: order.recipient_name ?? undefined,
            phone: order.recipient_phone ?? undefined,
            address: [order.address_line, order.city, order.governorate].filter(Boolean).join('، '),
          }
        : undefined,
    });
  }
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
};
