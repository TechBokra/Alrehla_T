import { createClient } from '@/lib/supabase/server';
import { fetchAllPages } from '@/lib/fetch-all';
import type { ServiceOrderRow } from '@/data/domains/(shared)/service-orders/types';
import { SERVICE_ORDER_SELECT, mapServiceOrders } from '@/data/domains/(shared)/service-orders/internal';

/** Every service order — row-level security limits this to admins. */
export async function getAllServiceOrders(): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  // ⚠️ على دفعات — Supabase بيقف عند ١٠٠٠ صف من غير رسالة (`lib/fetch-all`).
  const { data, error } = await fetchAllPages((from, to) =>
    supabase
      .from('service_orders')
      .select(SERVICE_ORDER_SELECT)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );

  if (error) return [];
  return mapServiceOrders(data, supabase);
}

/** Service orders placed for one instructor, newest first. */
export async function getServiceOrdersForInstructor(
  instructorId: string
): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapServiceOrders(data, supabase);
}

/** طلبات مقدّم خدمة بعينه — المنصة أو مدرب أو مستقل. */
export async function getServiceOrdersByProvider(
  providerId: string
): Promise<ServiceOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapServiceOrders(data, supabase);
}
