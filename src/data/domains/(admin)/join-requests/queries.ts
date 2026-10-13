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
