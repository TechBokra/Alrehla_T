import { createClient } from '@/lib/supabase/server';
import type { ServiceOrderMessage } from '@/data/domains/(shared)/service-orders/types';

/** The conversation on one order, oldest first. */
export async function getServiceOrderMessages(
  orderId: string
): Promise<ServiceOrderMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_order_messages')
    .select('id, order_id, sender_profile_id, body, is_delivery, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const senderIds = Array.from(new Set(data.map((m) => m.sender_profile_id)));
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', senderIds);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return data.map((m) => ({
    id: m.id,
    orderId: m.order_id,
    senderProfileId: m.sender_profile_id,
    senderName: nameById.get(m.sender_profile_id) ?? 'مستخدم',
    body: m.body,
    isDelivery: m.is_delivery,
    createdAt: m.created_at,
  }));
}
