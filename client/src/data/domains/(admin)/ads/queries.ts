import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { adStatus, type Ad, type AdStatus } from '@/lib/ads';
import { AD_COLUMNS, toAd, type AdRow } from '@/data/domains/(shared)/ads/queries';

export type AdWithStats = Ad & { clicks: number; status: AdStatus };

/**
 * إعلانات اللوحة — **كلها**، مش الشغّال بس.
 *
 * ⚠️ **بتستعمل عميل الخادم (`createClient`) مش العام**: سياسة
 *    القراءة العامة بترجّع الشغّال وقت القراءة بس، والإدارة لازم
 *    تشوف المجدول والمنتهي والموقوف — وإلا بتفتكر إن الإعلان
 *    اتمسح.
 *
 * ⚠️ **والنقرات في نداء واحد** (`ad_click_counts`) مش نداء لكل
 *    إعلان. ولو نداء العدّ فشل، الصفحة بتعرض الإعلانات والنقرات
 *    صفر **مع تسجيل الخطأ** — عدد غلط أهون من شاشة فاضية، بس
 *    مابنخفيش إن فيه مشكلة.
 */
export async function getAdsForAdmin(now: Date): Promise<{ ads: AdWithStats[]; countsFailed: boolean }> {
  const supabase = await createClient();

  const [adsResult, countsResult] = await Promise.all([
    supabase.from('ads').select(AD_COLUMNS),
    supabase.rpc('ad_click_counts'),
  ]);

  if (adsResult.error) {
    console.error('Error fetching ads for admin:', adsResult.error);
    throw new Error('تعذّر تحميل الإعلانات');
  }

  const counts = new Map<string, number>();
  let countsFailed = false;
  if (countsResult.error) {
    console.error('Error fetching ad click counts:', countsResult.error);
    countsFailed = true;
  } else {
    for (const row of (countsResult.data ?? []) as { ad_id: string; clicks: number }[]) {
      counts.set(row.ad_id, Number(row.clicks) || 0);
    }
  }

  const ads = ((adsResult.data ?? []) as AdRow[])
    .map((row) => {
      const ad = toAd(row);
      return { ...ad, clicks: counts.get(ad.id) ?? 0, status: adStatus(ad, now) };
    })
    // الظاهر الأول، وبعده المجدول، وبعده الموقوف والمنتهي.
    .sort((a, b) => {
      const rank: Record<AdStatus, number> = { live: 0, scheduled: 1, paused: 2, ended: 3 };
      return rank[a.status] - rank[b.status] || a.sortOrder - b.sortOrder;
    });

  return { ads, countsFailed };
}
