import { createClient } from '@/lib/supabase/server';
import type { SessionChangeRow } from '@/data/domains/(shared)/sessions/types';

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
