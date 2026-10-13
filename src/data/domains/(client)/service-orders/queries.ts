import type { QueryReadOptions } from '@/data/query-result';
import { createClient } from '@/lib/supabase/server';
import type { ServiceOrderRow } from '@/data/domains/(shared)/service-orders/types';
import { SERVICE_ORDER_SELECT, mapServiceOrders } from '@/data/domains/(shared)/service-orders/internal';

/** The signed-in customer's own service orders. */
export async function getMyServiceOrders(options: QueryReadOptions = {}): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('buyer_profile_id', user.id)
    .order('created_at', { ascending: false });

  if (error && options.throwOnError) throw error;
  if (error || !data) return [];
  return mapServiceOrders(data, supabase, options);
}
