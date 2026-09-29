import { createClient } from '@/lib/supabase/server';
import { nextSessionNumber, sessionQuota, type SessionQuota } from '@/lib/session-plan';

export type SubscriptionSessionRow = {
  id: string;
  sessionNumber: number;
  scheduledAt: string;
  status: string;
  hasRoom: boolean;
};

export type SubscriptionSessionPlan = {
  sessions: SubscriptionSessionRow[];
  quota: SessionQuota;
  /** رقم الجلسة الجاية لو الإدارة ضافت واحدة دلوقتي. */
  nextNumber: number;
  /** مدرب الاشتراك — الافتراضي للجلسة الجديدة. */
  instructorId: string | null;
  subscriptionStatus: string;
};

/**
 * جلسات اشتراك واحد، وعدد الباقة، والرقم الجاي.
 *
 * ⚠️ **الملغي مش محسوب في الحصّة.** جلسة اتلغت مارجعتش لرصيد
 *    الاشتراك لو عددناها — والطالب دفع تمن عدد، مش تمن محاولات.
 *    فالعدّ بيستبعد `cancelled`.
 *
 * ⚠️ **بس الرقم الجديد بيتحسب من كل الأرقام الموجودة، الملغي
 *    كمان.** ودي مش تناقضة: الحصّة سؤال مالي، والرقم سؤال تفرّد.
 *    لو استبعدنا الملغي من حساب الرقم، الرقم بيتكرّر.
 */
export async function getSubscriptionSessionPlan(
  subscriptionId: string,
): Promise<SubscriptionSessionPlan | null> {
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from('course_subscriptions')
    .select('id, package_id, preferred_instructor_id, status')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!subscription) return null;

  const [{ data: rows }, { data: pkg }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_number, scheduled_at, status, room_name')
      .eq('course_subscription_id', subscriptionId)
      .order('session_number', { ascending: true }),
    supabase
      .from('creative_writing_packages')
      .select('sessions_count')
      .eq('id', subscription.package_id)
      .maybeSingle(),
  ]);

  const sessions: SubscriptionSessionRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    sessionNumber: r.session_number,
    scheduledAt: r.scheduled_at,
    status: r.status,
    hasRoom: Boolean(r.room_name),
  }));

  return {
    sessions,
    quota: sessionQuota({
      packageSessions: pkg?.sessions_count ?? null,
      scheduledCount: sessions.filter((s) => s.status !== 'cancelled').length,
    }),
    nextNumber: nextSessionNumber(sessions.map((s) => s.sessionNumber)),
    instructorId: subscription.preferred_instructor_id ?? null,
    subscriptionStatus: subscription.status,
  };
}
