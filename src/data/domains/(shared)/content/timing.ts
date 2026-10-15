import 'server-only';
import type { SiteSettings } from '@/data/domains/(shared)/settings/types';
import { validDate, cairoCalendarDate, getServerNow } from '@/data/server-time';
import { isAfter, getYear } from 'date-fns';
import { postStatus } from '@/lib/blog-publish';

export function visibleAnnouncement(announcement: SiteSettings['announcement'], now: Date) {
  if (!announcement.enabled || !announcement.text.trim()) return null;
  const until = validDate(announcement.until);
  // Preserve the previous behavior for a missing/invalid expiration date.
  if (until && !isAfter(until, now)) return null;
  return { text: announcement.text, expiresAt: until?.getTime() ?? null };
}

/**
 * حالة كل مقال لقايمة الإدارة. `status` هي الحالة الحقيقية (منشور/مجدول/مسودة)،
 * و`isDraft` معناها هنا «مش ظاهر للزوار دلوقتي» (مجدول أو مسودة) — زي ما كانت.
 */
export function blogPublicationData<T extends { publishedAt: string; isDraft?: boolean }>(posts: T[], now: Date) {
  return posts.map((post) => {
    const status = postStatus(post, now);
    return { ...post, status, isDraft: status !== 'published' };
  });
}

export async function getCopyrightYear() {
  return getYear(cairoCalendarDate(getServerNow()));
}
