'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Marking notifications as read.
 *
 * Row-level security limits the update to the signed-in user's own rows, so
 * the `eq` here is for clarity rather than protection.
 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('recipient_profile_id', user.id);

  revalidatePath('/notifications');
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_profile_id', user.id)
    .eq('is_read', false);

  revalidatePath('/notifications');
  return { ok: true };
}
