import { createClient } from '@/lib/supabase/server';
import type { ReviewItem } from '@/data/domains/(shared)/reviews/types';
import { REVIEW_SELECT, mapReviews } from '@/data/domains/(shared)/reviews/reviews-internal';

/** Every review including the hidden ones — row-level security limits this to admins. */
export async function getAllReviews(): Promise<ReviewItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapReviews(data);
}
