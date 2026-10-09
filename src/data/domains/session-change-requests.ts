import { createClient } from '@/lib/supabase/server';

/**
 * طلبات تغيير موعد الجلسات (ملف 16 — #LQMO).
 *
 * ⚠️ قبل ما ملف 16 يتشغّل الجدول مش موجود — الدوال بترجع فاضي بدل خطأ،
 *    فالصفحات بتفتح عادي ومن غير الزرار.
 */
export type SessionChangeRow = {
  id: string;
  sessionId: string;
  requesterRole: 'guardian' | 'instructor' | 'student';
  requesterName: string;
  proposedAt: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  adminNote: string | null;
  createdAt: string;
  sessionAt: string | null;
  sessionNumber: number | null;
};

/** آخر طلب للجلسة دي من الداخل دلوقتي (القاعدة بتفلتر: طلباته هو بس). */
export async function getMySessionChange(sessionId: string): Promise<SessionChangeRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_change_requests')
    .select('id, session_id, requester_role, proposed_at, reason, status, admin_note, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    sessionId: data.session_id,
    requesterRole: data.requester_role as SessionChangeRow['requesterRole'],
    requesterName: '',
    proposedAt: data.proposed_at,
    reason: data.reason,
    status: data.status as SessionChangeRow['status'],
    adminNote: data.admin_note,
    createdAt: data.created_at,
    sessionAt: null,
    sessionNumber: null,
  };
}

/** للإدارة: المستني أولًا، وبعده آخر ٣٠ اتبتّ فيهم. */
export async function getSessionChangesForAdmin(): Promise<SessionChangeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_change_requests')
    .select('id, session_id, requester_profile_id, requester_role, proposed_at, reason, status, admin_note, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];

  const sessionIds = [...new Set(data.map((r) => r.session_id))];
  const people = [...new Set(data.map((r) => r.requester_profile_id))];
  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    sessionIds.length
      ? supabase.from('sessions').select('id, scheduled_at, session_number').in('id', sessionIds)
      : Promise.resolve({ data: [] as { id: string; scheduled_at: string; session_number: number }[] }),
    people.length
      ? supabase.from('user_profiles').select('id, full_name').in('id', people)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);
  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? '']));

  const rows = data.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    requesterRole: r.requester_role as SessionChangeRow['requesterRole'],
    requesterName: nameById.get(r.requester_profile_id) || '—',
    proposedAt: r.proposed_at,
    reason: r.reason,
    status: r.status as SessionChangeRow['status'],
    adminNote: r.admin_note,
    createdAt: r.created_at,
    sessionAt: sessionById.get(r.session_id)?.scheduled_at ?? null,
    sessionNumber: sessionById.get(r.session_id)?.session_number ?? null,
  }));
  const pending = rows.filter((r) => r.status === 'pending').reverse();
  const decided = rows.filter((r) => r.status !== 'pending').slice(0, 30);
  return [...pending, ...decided];
}
