import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth-guard';
import { getAdsForAdmin } from '@/data/domains/(admin)/ads/queries';
import { getServerNow } from '@/data/server-time';
import { AdsClient } from './AdsClient';

export const metadata: Metadata = { title: 'الإعلانات' };
export const dynamic = 'force-dynamic';

/**
 * إدارة الإعلانات.
 *
 * ⚠️ **`force-dynamic`**: الصفحة بتعرض حالة كل إعلان (ظاهر / مجدول /
 *    انتهى) وعدد نقراته، والاتنين بيتغيّروا مع الوقت من غير ما حد
 *    يعدّل حاجة. نسخة متخزّنة معناها إعلان بيقول «مجدول» وهو ظاهر
 *    على الموقع فعلًا.
 */
export default async function AdsPage() {
  await requireAdmin('canManageContent', 'غير مصرح لك بإدارة الإعلانات');
  const { ads, countsFailed } = await getAdsForAdmin(getServerNow());

  return <AdsClient ads={ads} countsFailed={countsFailed} />;
}
