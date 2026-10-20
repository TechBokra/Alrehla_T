import { NotificationItem } from '@/types';
import { createClient } from '@/lib/supabase/server';

export async function getNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, message, is_read, link, created_at')
    .eq('recipient_profile_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message ?? '',
    isRead: row.is_read,
    link: row.link ?? undefined,
    createdAt: row.created_at,
  }));
}

/** How many unread notifications the signed-in user has, for the header bell. */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_profile_id', user.id)
    .eq('is_read', false);

  return count ?? 0;
}
