import 'server-only';
import { isAfter } from 'date-fns';
import { getServerNow, validDate } from '@/data/server-time';
import { getCurrentUser } from './auth';
import { hasAdminPermission } from '@/lib/utils';
import { createAdminClient } from '@/lib/supabase/admin';

export function loginBlockedAt(bannedUntil: string | null | undefined, now: Date): boolean {
  const date = validDate(bannedUntil);
  return !!date && isAfter(date, now);
}
export async function getAdminUserAuthData(id: string, fallbackEmail: string) {
  const fallback = { accountEmail: fallbackEmail, loginBlocked: false };
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageUsers')) return fallback;
  try {
    const { data, error } = await createAdminClient().auth.admin.getUserById(id);
    if (error || !data.user) return fallback;
    const bannedUntil = (data.user as { banned_until?: string | null }).banned_until;
    return { accountEmail: data.user.email || fallbackEmail,
      loginBlocked: loginBlockedAt(bannedUntil, getServerNow()) };
  } catch {
    // Auth admin access is optional on this screen, as before.
    return fallback;
  }
}
