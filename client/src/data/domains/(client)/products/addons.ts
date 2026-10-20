import { AddonProduct } from '@/types';
import { decodeSlug } from '@/lib/utils';
import { createPublicClient } from '@/lib/supabase/public';
import { addonWithWatermark, mapAddonRow } from '@/data/domains/(shared)/products/products-internal';

/** إضافة واحدة مفعّلة لصفحة تفاصيلها العامة. */
export const getAddonBySlug = async (rawSlug: string): Promise<AddonProduct | null> => {
  const slug = decodeSlug(rawSlug);
  const { data, error } = await createPublicClient()
    .from('addon_products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return addonWithWatermark(mapAddonRow(data));
};
