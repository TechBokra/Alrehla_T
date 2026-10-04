import { createClient } from '@/lib/supabase/server';
import { FEEDBACK_LINES, type FeedbackLine } from '@/lib/feedback-lines';

export type FeedbackRow = {
  id: string;
  userId: string;
  line: FeedbackLine;
  rating: number;
  comment: string;
  status: 'new' | 'seen';
  createdAt: string;
};

const toRow = (r: {
  id: string;
  user_id: string;
  line: FeedbackLine;
  rating: number;
  comment: string | null;
  status: 'new' | 'seen';
  created_at: string;
}): FeedbackRow => ({
  id: r.id,
  userId: r.user_id,
  line: r.line,
  rating: r.rating,
  comment: r.comment ?? '',
  status: r.status,
  createdAt: r.created_at,
});

/**
 * الخطوط اللي العميل استعملها فعلًا (حاجة اتدفعت) + آراؤه اللي بعتها.
 *
 * ⚠️ «استعمل الخط ده؟» بتقرره القاعدة (`used_line`) — نفس الدالة اللي
 *    بتحرس الإدخال، فالفورم مايعرضش خط هيترفض.
 * `null` = ملف 10 لسه ماتشغّلش.
 */
export async function getMyFeedbackContext(): Promise<{
  lines: FeedbackLine[];
  mine: FeedbackRow[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { lines: [], mine: [] };

  const checks = await Promise.all(
    FEEDBACK_LINES.map((line) => supabase.rpc('used_line', { p_user: user.id, p_line: line })),
  );
  if (checks.some((c) => c.error)) return null;
  const lines = FEEDBACK_LINES.filter((_, i) => checks[i].data === true);

  const { data } = await supabase
    .from('customer_feedback')
    .select('id, user_id, line, rating, comment, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return { lines, mine: (data ?? []).map(toRow) };
}

/** آراء خط واحد — للوحة. الأحدث أولًا. `null` = ملف 10 لسه ماتشغّلش. */
export async function getFeedbackForLine(line: FeedbackLine): Promise<FeedbackRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_feedback')
    .select('id, user_id, line, rating, comment, status, created_at')
    .eq('line', line)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('تعذّر قراءة آراء العملاء', error);
    return null;
  }
  return (data ?? []).map(toRow);
}
