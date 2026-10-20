import { createClient } from '@/lib/supabase/server';

export async function hasReviewForOrder(orderId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reviews')
    .select('id')
    .eq('service_order_id', orderId)
    .maybeSingle();
  return Boolean(data);
}
