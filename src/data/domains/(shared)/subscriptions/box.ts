import type { BoxSubscription } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { withShipments } from '@/data/domains/(shared)/subscriptions/subscriptions-internal';

export const getBoxSubscription = async (id: string): Promise<BoxSubscription | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from('box_subscriptions').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const [sub] = await withShipments([data]);
  return sub ?? null;
};
