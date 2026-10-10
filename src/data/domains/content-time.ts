import 'server-only';
import { getYear, isAfter } from 'date-fns';
import { cairoCalendarDate, getServerNow, validDate } from '@/data/server-time';
import { getBlogPosts, getSiteSettings, type SiteSettings } from './content';

export function visibleAnnouncement(announcement: SiteSettings['announcement'], now: Date) {
  if (!announcement.enabled || !announcement.text.trim()) return null;
  const until = validDate(announcement.until);
  // Preserve the previous behavior for a missing/invalid expiration date.
  if (until && !isAfter(until, now)) return null;
  return { text: announcement.text };
}
export async function getAnnouncementData() {
  const { announcement } = await getSiteSettings();
  return visibleAnnouncement(announcement, getServerNow());
}

export function blogPublicationData<T extends { publishedAt: string }>(posts: T[], now: Date) {
  return posts.map((post) => {
    const publishedAt = validDate(post.publishedAt);
    return { ...post, isDraft: !!publishedAt && isAfter(publishedAt, now) };
  });
}
export async function getAdminBlogPublicationData() {
  return blogPublicationData(await getBlogPosts({ includeDrafts: true }), getServerNow());
}

export async function getCopyrightYear() {
  return getYear(cairoCalendarDate(getServerNow()));
}
