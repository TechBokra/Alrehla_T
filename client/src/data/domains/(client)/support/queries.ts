import { SupportTicket } from '@/types';
import { createClient } from '@/lib/supabase/server';

export async function getMyTickets(): Promise<SupportTicket[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, requester_name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status as SupportTicket['status'],
    requesterName: row.requester_name,
    createdAt: row.created_at,
  }));
}
