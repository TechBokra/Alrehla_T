import { createClient } from '@/lib/supabase/server';
import type { ServiceOrderRow } from '@/data/domains/(shared)/service-orders/types';
import { SERVICE_ORDER_SELECT, mapServiceOrders } from '@/data/domains/(shared)/service-orders/internal';

/**
 * One service order, for the order screen.
 *
 * Row-level security decides who may read it: the buyer, the assigned
 * instructor, or an admin. Anyone else gets null, so the page itself does not
 * have to repeat the authorisation rule.
 */
export async function getServiceOrderDetail(orderId: string): Promise<ServiceOrderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) return null;
  const [row] = await mapServiceOrders([data], supabase);
  return row ?? null;
}
