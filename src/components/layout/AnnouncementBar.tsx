import { getAnnouncementData } from '@/data/domains/(client)/content/page-data';
import { AnnouncementBarClient } from './AnnouncementBarClient';

/**
 * شريط التنبيه العلوي.
 *
 * بيتظبط من «الإعدادات العامة»: نص، وتشغيل/إيقاف، وتاريخ اختفاء تلقائي.
 *
 * ليه التاريخ مهم: التنبيه اللي بينسى مفتوح بيبقى جزء من ديكور الصفحة
 * وبيتجاهله الكل. التاريخ بيخليه يختفي لوحده بعد ما ينتهي سببه.
 *
 * الفحص بيتم على السيرفر، فالشريط المنتهي ما بيوصلش للمتصفح أصلًا.
 */
export async function AnnouncementBar() {
  const announcement = await getAnnouncementData();
  if (!announcement) return null;
  return <AnnouncementBarClient text={announcement.text} expiresAt={announcement.expiresAt} />;
}
