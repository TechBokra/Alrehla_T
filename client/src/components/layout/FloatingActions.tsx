import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { FloatingActionsClient } from './FloatingActionsClient';

/**
 * الزرّان العائمان — الغلاف اللي بيجيب الإعدادات على السيرفر.
 *
 * نفس نمط `AnnouncementBar`: السيرفر بيقرا الإعداد، والعميل بيتعامل مع
 * التمرير. رقم الواتساب هو **نفس الرقم اللي الفوتر بيستخدمه** — فمفيش
 * حقل جديد في لوحة الإدارة، ولو الرقم فاضي الزر مبيظهرش أصلًا.
 */
export async function FloatingActions() {
  const settings = await getSiteSettings();
  return <FloatingActionsClient whatsappNumber={settings.whatsappNumber} />;
}
