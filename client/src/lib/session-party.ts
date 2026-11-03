import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/types';

export type SessionPartyRole = 'instructor' | 'guardian' | 'student';

/**
 * مين المستخدم ده بالنسبة للجلسة: المدرب المسنَد، ولا صاحب الاشتراك
 * (ولي الأمر)، ولا الطالب نفسه.
 *
 * مكان واحد لطلبات تغيير الموعد وبلاغات الجلسات — كانت مكتوبة مرتين.
 *
 * ⚠️ بجلسة المستخدم (نفس العميل اللي اتأكد بيه إن الجلسة ظاهرة له):
 *    صلاحيات القاعدة هي اللي بتقرّر هو طرف ولا لأ، والدالة دي بتحدّد
 *    **أنهي** طرف بس.
 */
export async function sessionPartyRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: Pick<UserProfile, 'id' | 'role'>,
  session: { instructor_id: string | null; course_subscription_id: string | null },
): Promise<SessionPartyRole> {
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (instructor && instructor.id === session.instructor_id) return 'instructor';

  const { data: sub } = await supabase
    .from('course_subscriptions')
    .select('user_id')
    .eq('id', session.course_subscription_id as string)
    .maybeSingle();
  if (sub?.user_id === user.id && user.role !== 'student') return 'guardian';
  return 'student';
}
