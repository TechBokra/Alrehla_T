import { createClient } from '@/lib/supabase/server';
import type { ShippingRateRow } from '@/data/domains/(shared)/shipping/types';

/** Every area including the disabled ones — for the admin screen. */
export async function getAllShippingRates(): Promise<ShippingRateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('id, governorate, city, fee, is_active')
    .order('governorate', { ascending: true })
    .order('city', { ascending: true });

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    governorate: r.governorate,
    city: r.city ?? '',
    fee: r.fee,
    isActive: r.is_active,
  }));
}
