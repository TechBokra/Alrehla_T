import { createClient } from '@/lib/supabase/server';
import type { ReviewItem, RatingSummary } from '@/data/domains/(shared)/reviews/types';
import { REVIEW_SELECT, mapReviews } from '@/data/domains/(shared)/reviews/reviews-internal';
import { createPublicClient } from '@/lib/supabase/public';

/** Visible reviews for one instructor, newest first. */
export async function getReviewsForInstructor(instructorId: string): Promise<ReviewItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('instructor_id', instructorId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return mapReviews(data);
}

/**
 * Average and count per instructor, for a whole list of them at once.
 *
 * One query for the page rather than one per card.
 */
export async function getInstructorRatingSummaries(
  instructorIds: string[]
): Promise<Map<string, RatingSummary>> {
  const summaries = new Map<string, RatingSummary>();
  if (instructorIds.length === 0) return summaries;

  // ⚡ التقييمات الظاهرة عامة — عميل الزائر عشان صفحة المدربين تتخزّن.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('instructor_id, rating')
    .in('instructor_id', instructorIds)
    .eq('is_hidden', false);

  if (error || !data) return summaries;

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of data) {
    const current = totals.get(row.instructor_id) ?? { sum: 0, count: 0 };
    current.sum += row.rating;
    current.count += 1;
    totals.set(row.instructor_id, current);
  }

  for (const [id, { sum, count }] of totals) {
    summaries.set(id, { average: count > 0 ? sum / count : null, count });
  }
  return summaries;
}

export async function getInstructorRatingSummary(
  instructorId: string
): Promise<RatingSummary> {
  const summaries = await getInstructorRatingSummaries([instructorId]);
  return summaries.get(instructorId) ?? { average: null, count: 0 };
}
