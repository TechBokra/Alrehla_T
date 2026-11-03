import type { QueryReadOptions } from '@/data/query-result';
import { Order, OrderItem } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { fetchAllPages, fetchIn } from '@/lib/fetch-all';
import { mapOrder, mapOrderItem } from '@/data/domains/(shared)/orders/map';

/**
 * Every order — for the admin screens.
 *
 * The admin order pages used `getOrders`, which filters by the signed-in
 * user: an admin was shown only their OWN orders and believed that was the
 * whole list. Row-level security is what actually limits this read.
 *
 * Items are fetched in a second query rather than as a join, because the
 * generated types carry no relationship for it and a joined shape would have
 * to be cast away — which is how untyped data got into this codebase before.
 */
export async function getAllOrders(options: QueryReadOptions = {}): Promise<Order[]> {
  const supabase = await createClient();
  // ⚠️ على دفعات — Supabase بيقف عند ١٠٠٠ صف من غير رسالة (`lib/fetch-all`).
  const { data, error } = await fetchAllPages((from, to) =>
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );

  if (error) {
    if (options.throwOnError) throw error;
    return [];
  }

  const items = await fetchIn(
    data.map((o) => o.id),
    (part) =>
      supabase
        .from('order_items')
        .select('order_id, product_id, quantity, unit_price, customization_data, format')
        .in('order_id', part),
    undefined,
    options,
  );

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(mapOrderItem(item));
    itemsByOrder.set(item.order_id, list);
  }

  return data.map((order) => mapOrder(order, itemsByOrder.get(order.id) ?? []));
}
