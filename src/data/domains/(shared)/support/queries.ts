import { SupportTicketMessage } from '@/types';
import { createClient } from '@/lib/supabase/server';

export async function getMessagesForTicket(ticketId: string): Promise<SupportTicketMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select('id, ticket_id, sender_profile_id, message, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    ticketId: row.ticket_id,
    senderName: row.sender_profile_id,
    message: row.message,
    createdAt: row.created_at,
  }));
}
