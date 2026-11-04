import { Order } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { mapOrder, mapOrderItem } from '@/data/domains/(shared)/orders/map';

export const getOrders = async (): Promise<Order[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((order) =>
    mapOrder(order, ((order.order_items ?? []) as Parameters<typeof mapOrderItem>[0][]).map(mapOrderItem)),
  );
};
