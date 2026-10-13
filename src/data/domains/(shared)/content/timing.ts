import 'server-only';
import type { SiteSettings } from '@/data/domains/(shared)/settings/types';
import { validDate, cairoCalendarDate, getServerNow } from '@/data/server-time';
import { isAfter, getYear } from 'date-fns';

export function visibleAnnouncement(announcement: SiteSettings['announcement'], now: Date) {
  if (!announcement.enabled || !announcement.text.trim()) return null;
  const until = validDate(announcement.until);
  // Preserve the previous behavior for a missing/invalid expiration date.
  if (until && !isAfter(until, now)) return null;
  return { text: announcement.text, expiresAt: until?.getTime() ?? null };
}

export function blogPublicationData<T extends { publishedAt: string }>(posts: T[], now: Date) {
  return posts.map((post) => {
    const publishedAt = validDate(post.publishedAt);
    return { ...post, isDraft: !!publishedAt && isAfter(publishedAt, now) };
  });
}

export async function getCopyrightYear() {
  return getYear(cairoCalendarDate(getServerNow()));
}
