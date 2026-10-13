import { SessionMessage } from '@/types';
import { createClient } from '@/lib/supabase/server';

/**
 * رسائل الجلسة.
 *
 * كانت بترجّع رسالتين مكتوبتين في الكود من أشخاص مخترعين بتواريخ 2024،
 * وبتتعرض في صفحة الجلسة في لوحة الإدارة كأنها محادثة حقيقية.
 *
 * ملاحظة: عمود الربط في الجدول اسمه `booking_id` من تسمية قديمة، وبنمرّر
 * له رقم الجلسة — ده الربط الوحيد الموجود.
 */
export const getSessionMessages = async (sessionId: string): Promise<SessionMessage[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_messages')
    .select('id, booking_id, sender_profile_id, message, created_at')
    .eq('booking_id', sessionId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const senderIds = [...new Set(data.map((m) => m.sender_profile_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', senderIds);

  const nameById = new Map((profiles ?? []).map((p) => [String(p.id), p.full_name]));

  return data.map((m) => ({
    id: m.id,
    sessionId: m.booking_id,
    senderName: nameById.get(String(m.sender_profile_id)) ?? 'مستخدم',
    message: m.message,
    createdAt: m.created_at,
  }));
};
