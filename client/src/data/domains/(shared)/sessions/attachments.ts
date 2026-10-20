import { SessionAttachment } from '@/types';
import { createClient } from '@/lib/supabase/server';

/** مرفقات الجلسة. كانت ملفين مخترعين بروابط «#» ما بتفتحش حاجة. */
export const getSessionAttachments = async (sessionId: string): Promise<SessionAttachment[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_attachments')
    .select('id, booking_id, file_name, file_url')
    .eq('booking_id', sessionId);

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    sessionId: a.booking_id,
    fileName: a.file_name,
    fileUrl: a.file_url,
  }));
};
