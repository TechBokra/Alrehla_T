import { type FeedbackLine, FEEDBACK_LINES } from '@/lib/feedback-lines';
import { createClient } from '@/lib/supabase/server';
import type { FeedbackRow } from '@/data/domains/(shared)/feedback/types';
import { validFeedbackRows } from '@/data/domains/(shared)/feedback/feedback-internal';

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

  return { lines, mine: validFeedbackRows(data ?? []) };
}
