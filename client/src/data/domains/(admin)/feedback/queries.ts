import type { FeedbackLine } from '@/lib/feedback-lines';
import { createClient } from '@/lib/supabase/server';
import type { FeedbackRow } from '@/data/domains/(shared)/feedback/types';
import { validFeedbackRows } from '@/data/domains/(shared)/feedback/feedback-internal';

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
  return validFeedbackRows(data ?? []);
}
