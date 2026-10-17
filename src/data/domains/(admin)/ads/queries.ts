import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { type Ad, adStatus, type AdStatus } from '@/lib/ads';

export type AdWithStats = Ad & { clicks: number; status: AdStatus };

type Row = {
  id: string;
  title: string;
  advertiser_name: string | null;
  image_url: string;
  image_url_mobile: string | null;
  link_url: string | null;
  placements: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
};

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
    supabase.from('ads').select(
      'id, title, advertiser_name, image_url, image_url_mobile, link_url, placements, starts_at, ends_at, is_active, sort_order',
    ),
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

  const ads = ((adsResult.data ?? []) as Row[])
    .map((row) => {
      const ad: Ad = {
        id: row.id,
        title: row.title,
        advertiserName: row.advertiser_name,
        imageUrl: row.image_url,
        imageUrlMobile: row.image_url_mobile,
        linkUrl: row.link_url,
        placements: row.placements ?? [],
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      };
      return { ...ad, clicks: counts.get(ad.id) ?? 0, status: adStatus(ad, now) };
    })
    // الظاهر الأول، وبعده المجدول، وبعده الموقوف والمنتهي.
    .sort((a, b) => {
      const rank: Record<AdStatus, number> = { live: 0, scheduled: 1, paused: 2, ended: 3 };
      return rank[a.status] - rank[b.status] || a.sortOrder - b.sortOrder;
    });

  return { ads, countsFailed };
}
