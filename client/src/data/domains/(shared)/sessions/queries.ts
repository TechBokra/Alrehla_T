import type { QueryReadOptions } from '@/data/query-result';
import { SessionWithDetails } from '@/types';
import { createClient } from '@/lib/supabase/server';

export const getSessions = async (options: QueryReadOptions = {}): Promise<SessionWithDetails[]> => {
  const supabase = await createClient();
  // اسم الباقة والرقم المرجعي بيتجابوا مع الجلسة.
  //
  // شاشة «المواعيد والجلسات» عند العميل كانت بتعرض `package_id` الخام
  // («pkg-3») تحت عنوان «الباقة»، ورقم الجلسة الداخلي (UUID) تحت عنوان
  // «رقم الحجز» — وهو مش رقم الحجز أصلًا. العميل بيشوف تلات أعمدة
  // مالهاش أي معنى عنده.
  const { data, error } = await supabase
    .from('sessions')
    .select(
      '*, course_subscriptions(*, creative_writing_packages(name))'
    )
    .order('scheduled_at', { ascending: true });

  if (error && options.throwOnError) throw error;
  if (error || !data || data.length === 0) {
    return [];
  }

  return data.map((sess: any) => {
    const sub = sess.course_subscriptions;
    return {
      id: sess.id,
      courseSubscriptionId: sess.course_subscription_id,
      sessionNumber: sess.session_number,
      instructorId: sess.instructor_id || undefined,
      status: sess.status as any,
      scheduledAt: sess.scheduled_at,
      createdAt: sess.created_at,
      updatedAt: sess.updated_at || sess.created_at,
      meetingUrl: sess.meeting_url || undefined,
      // joined details
      userId: sub?.user_id || 'unknown',
      participantType: sub?.participant_type || 'self',
      childId: sub?.child_id || undefined,
      packageId: sub?.package_id || 'unknown',
      packageName: sub?.creative_writing_packages?.name || undefined,
      paymentReference: sub?.payment_reference || undefined,
    };
  });
};
