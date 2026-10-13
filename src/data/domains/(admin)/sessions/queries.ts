import type { QueryReadOptions } from '@/data/query-result';
import { InstructorSession } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { getParticipantNames, participantKey } from '@/data/domains/(shared)/participants/queries';
import { isSessionOverdue } from '@/lib/session-status';
import type { AdminSessionRow } from '@/data/domains/(admin)/sessions/types';
import { getSessions } from '@/data/domains/(shared)/sessions/queries';

/**
 * جلسات المدرب، ومعاها اسم المشارك واسم الباقة.
 *
 * `getSessions()` العامة بتعمل join على `course_subscriptions`، والـjoin
 * ده **بيرجع فاضي للمدرب** لأن صلاحيات القاعدة مانعاه من الجدول. فكل
 * جلساته كانت بتاخد `userId = 'unknown'`، ومنها «مشارك غير معروف»
 * و«الطالب #»، وعدّاد «الطلاب الحاليين: 1» اللي كان بيعدّ قيمة
 * `'unknown'` واحدة مش طالب.
 */
export async function getInstructorSessions(options: QueryReadOptions = {}): Promise<InstructorSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('instructor_sessions');
  if (error && options.throwOnError) throw error;

  if (error || !data) {
    if (error) console.error('Error loading instructor sessions', error);
    return [];
  }

  return data.map((row) => ({
    id: row.session_id,
    sessionNumber: row.session_number,
    scheduledAt: row.scheduled_at,
    status: row.status as InstructorSession['status'],
    meetingUrl: row.meeting_url ?? undefined,
    courseSubscriptionId: row.subscription_id,
    participantName: row.participant_name,
    packageName: row.package_name,
    packageId: row.package_id,
    studentRef: row.user_ref,
    childId: row.child_ref ?? undefined,
  }));
}

/**
 * كل الجلسات ومعاها تقاريرها — صفوف شاشة **الجلسات والتقارير**.
 *
 * ── بلاغ فريق العمل (27 سبتمبر) ─────────────────────────────
 *
 * «المدرب trainer2 أرسل تقريرًا عن حضور ميار أحمد… **لم أجد في لوحة
 *  تحكم الإدارة أي صفحة لمتابعة هذه التقارير**.»
 *
 * ⚠️ **والبلاغ دقيق.** كان في `/dashboard/admin/sessions/[id]` صفحة
 *    لجلسة واحدة — **ومفيش قايمة تودّي لها**. مفيش رابط في القايمة
 *    الجانبية، ومفيش صفحة فهرس. الطريق الوحيد ليها كان إشعار الغياب
 *    اللي ضفناه امبارح. يعني تقرير موجود في القاعدة، وشاشة تعرضه،
 *    ومفيش طريق بينهم.
 *
 * ── والقايمة بتجيب التقرير مع الجلسة ────────────────────────
 *
 * ⚠️ **مش استعلام لكل جلسة.** التقارير بتتجاب بـ`in` واحد، والأسماء
 *    بـ`getParticipantNames`، والمدربون باستعلام واحد. أربع استعلامات
 *    لأي عدد جلسات — بدل `2 + 1` لكل جلسة.
 */
export async function getSessionsForAdmin(): Promise<AdminSessionRow[]> {
  const sessions = await getSessions();
  if (sessions.length === 0) return [];

  const supabase = await createClient();

  const sessionIds = sessions.map((s) => s.id);
  const instructorIds = [
    ...new Set(sessions.map((s) => s.instructorId).filter(Boolean)),
  ] as string[];

  const [{ data: reports }, { data: instructors }, { data: rooms }, names] = await Promise.all([
    supabase
      .from('session_reports')
      .select('session_id, attendance, report, updated_at')
      .in('session_id', sessionIds),
    instructorIds.length
      ? supabase.from('instructors').select('id, display_name').in('id', instructorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    // اسم الغرفة مش في `getSessions()` — بيتجاب هنا عشان لوحة
    // الغرف تعرف مين ليه مكان لقاء ومين لأ.
    supabase.from('sessions').select('id, room_name').in('id', sessionIds),
    getParticipantNames(
      sessions.map((s) => ({ dependentId: s.childId, independentId: s.userId })),
    ),
  ]);

  const reportBySession = new Map((reports ?? []).map((r) => [r.session_id, r]));
  const roomBySession = new Map(
    (rooms ?? []).map((r) => [r.id, r.room_name as string | null]),
  );
  const instructorName = new Map((instructors ?? []).map((i) => [i.id, i.display_name]));

  return sessions.map((s) => {
    const report = reportBySession.get(s.id);
    return {
      id: s.id,
      sessionNumber: s.sessionNumber,
      scheduledAt: s.scheduledAt,
      status: s.status,
      participantName:
        names.get(participantKey(s.childId, s.userId)) ?? 'مشارك غير معروف',
      packageName: s.packageName ?? 'باقة محذوفة',
      instructorName: s.instructorId
        ? (instructorName.get(s.instructorId) ?? 'مدرب محذوف')
        : null,
      paymentReference: s.paymentReference ?? null,
      attendance: report ? (report.attendance === 'absent' ? 'absent' : 'present') : null,
      reportText: report?.report ?? '',
      reportedAt: report?.updated_at ?? null,
      isOverdue: isSessionOverdue(s),
      roomName: roomBySession.get(s.id) ?? null,
    };
  });
}
