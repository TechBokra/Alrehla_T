import 'server-only';
import { getSiteSettings } from '@/data/domains/content';
import { publicIdFromUrl } from '@/lib/cloudinary-admin';

/**
 * رقم طبقة العلامة المائية = شعار الموقع المرفوع (صور الموقع ← الشعار).
 * `null` = مفيش شعار ← الصور بتطلع من غير علامة بدل ما تبوظ.
 *
 * ⚠️ لو الشعار اتغيّر، العلامة بتتغيّر معاه في كل الصور تلقائيًا.
 */
export async function getWatermarkLayer(): Promise<string | null> {
  const settings = await getSiteSettings();
  return publicIdFromUrl(settings.images.logo)?.replace(/\//g, ':') ?? null;
}
