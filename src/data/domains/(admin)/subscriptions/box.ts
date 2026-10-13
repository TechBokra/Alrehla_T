import type { BoxSubscription } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { withShipments } from '@/data/domains/(shared)/subscriptions/subscriptions-internal';

/** كل الاشتراكات — للإدارة (الصلاحيات هي اللي بتقصر القراءة). */
export const getBoxSubscriptions = async (): Promise<BoxSubscription[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('box_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return withShipments(data);
};
