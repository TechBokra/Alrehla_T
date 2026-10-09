import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * Ratings left by customers.
 *
 * Everything here comes from the database, and a review can only exist against
 * a completed order — the rule is enforced by row-level security, not by this
 * file. Earlier versions of the site displayed invented reviews; nothing here
 * can produce one.
 */

export type ReviewItem = {
  id: string;
  instructorId: string;
  serviceId: string | null;
  reviewerName: string;
  /** How the instructor was rated, 1–5. */
  rating: number;
  /** How the service itself was rated, 1–5, when given. */
  serviceRating: number | null;
  comment: string;
  createdAt: string;
  isHidden: boolean;
  hiddenReason: string | null;
};

export type RatingSummary = {
  /** null when there are no reviews yet — shown as "مدرب جديد", never as zero. */
  average: number | null;
  count: number;
};

/** First name plus an initial: "أحمد م." — a full name is more than this needs. */
function shortName(fullName: string | null | undefined): string {
  const name = (fullName ?? '').trim();
  if (!name) return 'عميل';
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

const REVIEW_SELECT =
  'id, instructor_id, standalone_service_id, reviewer_profile_id, rating, service_rating, comment, created_at, is_hidden, hidden_reason';

async function mapReviews(
  rows: {
    id: string;
    instructor_id: string;
    standalone_service_id: string | null;
    reviewer_profile_id: string | null;
    rating: number;
    service_rating: number | null;
    comment: string | null;
    created_at: string;
    is_hidden: boolean;
    hidden_reason: string | null;
  }[]
): Promise<ReviewItem[]> {
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const ids = Array.from(
    new Set(rows.map((r) => r.reviewer_profile_id).filter((id): id is string => Boolean(id)))
  );

  const { data: profiles } = ids.length
    ? await supabase.from('user_profiles').select('id, full_name').in('id', ids)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => ({
    id: r.id,
    instructorId: r.instructor_id,
    serviceId: r.standalone_service_id,
    reviewerName: shortName(
      r.reviewer_profile_id ? nameById.get(r.reviewer_profile_id) : undefined
    ),
    rating: r.rating,
    serviceRating: r.service_rating,
    comment: r.comment ?? '',
    createdAt: r.created_at,
    isHidden: r.is_hidden,
    hiddenReason: r.hidden_reason,
  }));
}

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

export async function hasReviewForOrder(orderId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reviews')
    .select('id')
    .eq('service_order_id', orderId)
    .maybeSingle();
  return Boolean(data);
}

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
