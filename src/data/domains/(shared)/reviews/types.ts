

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
