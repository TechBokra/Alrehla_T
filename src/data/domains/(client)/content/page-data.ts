import 'server-only';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getServerNow } from '@/data/server-time';
import { visibleAnnouncement } from '@/data/domains/(shared)/content/timing';

export async function getAnnouncementData() {
  const { announcement } = await getSiteSettings();
  return visibleAnnouncement(announcement, getServerNow());
}
