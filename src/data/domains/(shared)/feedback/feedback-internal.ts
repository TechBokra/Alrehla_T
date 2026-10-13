import { FEEDBACK_LINES, type FeedbackLine } from '@/lib/feedback-lines';
import type { FeedbackRow } from '@/data/domains/(shared)/feedback/types';

type FeedbackRecord = {
  id: string;
  user_id: string;
  line: string;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
};

const toRow = (r: FeedbackRecord): FeedbackRow | null => {
  if (!FEEDBACK_LINES.includes(r.line as FeedbackLine)) return null;
  if (r.status !== 'new' && r.status !== 'seen') return null;
  return {
    id: r.id,
    userId: r.user_id,
    line: r.line as FeedbackLine,
    rating: r.rating,
    comment: r.comment ?? '',
    status: r.status,
    createdAt: r.created_at,
  };
};

export function validFeedbackRows(rows: FeedbackRecord[]): FeedbackRow[] {
  return rows.flatMap((row) => {
    const parsed = toRow(row);
    return parsed ? [parsed] : [];
  });
}
