import { joinFollowUp, lastMessages, type FollowUp } from '@/lib/join-followup';
import { JoinRequest } from '@/types';
import { createClient } from '@/lib/supabase/server';

export const getJoinRequests = async (): Promise<JoinRequest[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('join_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.id,
    applicantName: r.applicant_name,
    requestedRole: r.requested_role,
    status: r.status,
    createdAt: r.created_at,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    portfolioUrl: r.portfolio_url ?? undefined,
    message: r.message ?? undefined,
  }));
};

/**
 * حالة المتابعة لكل طلب «قيد المراجعة» — مين عليه الدور (اقرا `lib/join-followup`).
 * فشل القراءة = كأن مفيش رسايل (الطلب بيبان «جديد» — الأأمن إنه يظهر).
 */
export async function getJoinFollowUps(
  pending: { id: string; status: string; createdAt: string }[],
): Promise<Map<string, FollowUp>> {
  const out = new Map<string, FollowUp>();
  const open = pending.filter((r) => r.status === 'pending');
  if (open.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from('join_request_messages')
    .select('request_id, author, created_at')
    .in('request_id', open.map((r) => r.id));
  const last = lastMessages(data ?? []);
  for (const r of open) out.set(r.id, joinFollowUp(r, last.get(r.id) ?? null));
  return out;
}
