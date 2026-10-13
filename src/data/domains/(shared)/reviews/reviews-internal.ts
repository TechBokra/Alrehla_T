import { createClient } from '@/lib/supabase/server';
import type { ReviewItem } from '@/data/domains/(shared)/reviews/types';

/** First name plus an initial: "أحمد م." — a full name is more than this needs. */
function shortName(fullName: string | null | undefined): string {
  const name = (fullName ?? '').trim();
  if (!name) return 'عميل';
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

export const REVIEW_SELECT =
  'id, instructor_id, standalone_service_id, reviewer_profile_id, rating, service_rating, comment, created_at, is_hidden, hidden_reason';

export async function mapReviews(
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
