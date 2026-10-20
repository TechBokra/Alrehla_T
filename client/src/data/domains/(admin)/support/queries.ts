import { SupportTicket, SupportSessionRequest } from '@/types';
import { createClient } from '@/lib/supabase/server';

export const getAllSupportTickets = async (): Promise<SupportTicket[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((t: any) => ({
    id: t.id,
    requesterName: t.requester_name,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.created_at
  }));
};

export const getSupportSessionRequests = async (): Promise<SupportSessionRequest[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('support_session_requests')
    .select('*')
    .order('created_at', { ascending: false });

  // ⚠️ الخطأ بيترمي: الفاضي هنا بيتقري «مفيش طلبات» والناس مستنية رد.
  if (error) {
    console.error('تعذّر قراءة طلبات المساعدة في الحجز', error);
    throw new Error('تعذّر تحميل الطلبات');
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    userId: r.user_id ?? undefined,
  }));
};
