import type { QueryReadOptions } from '@/data/query-result';
import { StudentSession } from '@/types';
import { createClient } from '@/lib/supabase/server';

/**
 * جلسات المتعلّم — للطالب البالغ وللطفل صاحب الحساب التابع.
 *
 * `getSessions()` العامة بتعتمد على صلاحيات القاعدة، وهي بتدّي الجلسات
 * لصاحب الاشتراك. لكن اشتراك الطفل **صاحبه ولي الأمر**
 * (`course_subscriptions.user_id` = ولي الأمر، و`child_id` = الطفل) —
 * فحساب الطفل ما كانش هيشوف ولا جلسة.
 *
 * والحل مش سياسة قراءة على `course_subscriptions`: الصلاحيات بتحمي
 * الصفوف لا الأعمدة، والسياسة كانت هتخلي الطفل يشوف إيصال تحويل أبوه
 * والمبلغ. الدالة بترجّع الجلسة والباقة والمدرب وبس.
 */
export async function getStudentSessions(options: QueryReadOptions = {}): Promise<StudentSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('student_sessions');
  if (error && options.throwOnError) throw error;

  if (error || !data) {
    if (error) console.error('Error loading student sessions', error);
    return [];
  }

  return data.map((row) => ({
    id: row.session_id,
    sessionNumber: row.session_number,
    scheduledAt: row.scheduled_at,
    status: row.status as StudentSession['status'],
    meetingUrl: row.meeting_url ?? undefined,
    packageName: row.package_name,
    instructorName: row.instructor_name ?? undefined,
  }));
}
