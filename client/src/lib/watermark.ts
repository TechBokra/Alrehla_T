import 'server-only';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { watermarkLayer } from '@/lib/watermark-settings';

/**
 * طبقة العلامة المائية للصفحات العامة — من «الإعدادات العامة ← العلامة
 * المائية». `null` = مقفولة، والصور بتطلع زي ما هي.
 *
 * ⚠️ تغيير الإعداد بيغيّر العلامة في كل الصور مرة واحدة: الحفظ بيحدّث
 *    كل صفحات الموقع (`revalidatePath('/', 'layout')`).
 */
export async function getWatermarkLayer(): Promise<string | null> {
  const settings = await getSiteSettings();
  return watermarkLayer(settings.watermark);
}
