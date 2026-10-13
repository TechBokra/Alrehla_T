import type { QueryReadOptions } from '@/data/query-result';
import { createClient } from '@/lib/supabase/server';
import type { SessionChangeRow } from '@/data/domains/(shared)/sessions/types';

/** آخر طلب للجلسة دي من الداخل دلوقتي (القاعدة بتفلتر: طلباته هو بس). */
export async function getMySessionChange(sessionId: string, options: QueryReadOptions = {}): Promise<SessionChangeRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_change_requests')
    .select('id, session_id, requester_role, proposed_at, reason, status, admin_note, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && options.throwOnError) throw error;
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
