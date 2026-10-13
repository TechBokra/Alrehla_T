import { createClient } from '@/lib/supabase/server';
import type { ShippingRate } from '@/data/domains/(shared)/shipping/types';

/**
 * Shipping fees by governorate, set by the admin.
 *
 * Checkout used to charge a flat 50 EGP with the comment "Fixed shipping logic
 * for demo". Shipping is not flat, so the number now comes from here — and
 * when nothing is configured the customer is told the fee will be confirmed
 * rather than shown an invented one.
 */
export async function getShippingRates(): Promise<ShippingRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('governorate, city, fee')
    .eq('is_active', true)
    .order('governorate', { ascending: true })
    .order('city', { ascending: true });

  if (error || !data) return [];
  return data
    .filter((r) => Boolean(r.city))
    .map((r) => ({ governorate: r.governorate, city: r.city as string, fee: r.fee }));
}
