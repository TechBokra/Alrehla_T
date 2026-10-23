import { createClient } from '@/lib/supabase/server';

export async function hasReviewForOrder(orderId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reviews')
    .select('id')
    .eq('service_order_id', orderId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * الباقات اللي خلصت وينفع ولي الأمر يقيّمها.
 *
 * ⚠️ **بتتبني من الجلسات مش من حالة الاشتراك.** `course_subscriptions.status`
 *    بيوصف الدفع والإلغاء، مش «خلصت جلساتها». والباقة بتنتهي فعليًا لما
 *    آخر جلسة تتقفل — وده اللي `bookingReviewState` بتقرره.
 *
 * ⚠️ **وفشل القراءة بيرجّع قايمة فاضية عن قصد**: الكارت ده إضافة
 *    على شاشة المواعيد، وفشله مايستاهلش يكسّر الشاشة كلها. والحارس
 *    الحقيقي في الأكشن — اللي بيعيد الفحص قبل ما يكتب.
 */
export async function getReviewableBookings(): Promise<
  { subscriptionId: string; packageName: string; instructorName: string | null }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: subs, error } = await supabase
    .from('course_subscriptions')
    .select('id, creative_writing_packages(name)')
    .eq('user_id', user.id);
  if (error || !subs?.length) return [];

  const ids = subs.map((s) => s.id);
  const [{ data: sessions }, { data: reviewed }] = await Promise.all([
    supabase
      .from('sessions')
      .select('course_subscription_id, status, instructor_id, instructors(full_name)')
      .in('course_subscription_id', ids),
    supabase.from('reviews').select('booking_id').in('booking_id', ids),
  ]);

  const reviewedIds = new Set((reviewed ?? []).map((r) => r.booking_id));
  const { bookingReviewState } = await import('@/lib/review-eligibility');

  return subs.flatMap((sub) => {
    const mine = (sessions ?? []).filter((s) => s.course_subscription_id === sub.id);
    const state = bookingReviewState(mine, reviewedIds.has(sub.id));
    if (!state.can) return [];
    const taught = mine.find((s) => s.status === 'completed' && s.instructor_id);
    const pkg = sub.creative_writing_packages as { name?: string } | null;
    return [
      {
        subscriptionId: sub.id,
        packageName: pkg?.name ?? 'باقة',
        instructorName:
          (taught?.instructors as { full_name?: string } | null)?.full_name ?? null,
      },
    ];
  });
}
