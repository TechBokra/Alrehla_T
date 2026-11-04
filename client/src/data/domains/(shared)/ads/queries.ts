import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { type Ad, visibleAds } from '@/lib/ads';

/** صفّ الإعلان من القاعدة — مشترك بين الموقع واللوحة. */
export type AdRow = {
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

export const AD_COLUMNS =
  'id, title, advertiser_name, image_url, image_url_mobile, link_url, placements, starts_at, ends_at, is_active, sort_order';

export function toAd(row: AdRow): Ad {
  return {
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
}

/**
 * إعلانات الموقع كلها (اللي القاعدة بتسمح بقراءتها).
 *
 * ⚠️ **نداء واحد لكل عرض للصفحة، مش نداء لكل خانة.** الصفحة فيها
 *    خانتين (فوق وتحت)، ولو كل خانة بتسأل القاعدة بنفسها بيبقى
 *    استعلامين لحاجة حجمها صفوف قليلة. `React.cache` بيخلّي
 *    النداء واحدًا والخانتين بتفلترا منه.
 *
 * ⚠️ **وسياسة القاعدة بترجّع الشغّال وقت القراءة بس** — المقفول
 *    والمنتهي والمجدول مش بيخرجوا أصلًا. الفلترة في `visibleAds`
 *    فوقها للترتيب وللحدود بتوقيت السيرفر.
 *
 * ⚠️ **والخطأ بيرجع قايمة فاضية**: صفحة من غير إعلان أحسن من صفحة
 *    واقعة. وبيتسجّل في اللوج عشان مايضيعش في سكوت.
 */
export const getAds = cache(async (): Promise<Ad[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('ads').select(AD_COLUMNS);

  if (error || !data) {
    if (error) console.error('Error fetching ads:', error);
    return [];
  }
  return (data as AdRow[]).map(toAd);
});

/** إعلانات خانة واحدة، جاهزة للعرض. */
export async function getAdsForPlacement(placement: string, now: Date): Promise<Ad[]> {
  return visibleAds(await getAds(), placement, now);
}
