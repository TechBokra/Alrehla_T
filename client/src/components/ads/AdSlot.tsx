import { getAdsForPlacement } from '@/data/domains/(shared)/ads/queries';
import { getServerNow } from '@/data/server-time';
import { type AdPosition, placementKey } from '@/lib/ads';
import { AdSlider } from './AdSlider';

/**
 * خانة إعلان في صفحة.
 *
 * ⚠️ **مكوّن خادم بيلفّ مكوّن عميل**: الاستعلام بيحصل على الخادم،
 *    والسلايدر (حركة وأزرار) هو اللي بيوصل للمتصفح. كده الصفحة
 *    مابتبعتش كود الإعلانات لو مفيش إعلان أصلًا.
 *
 * ⚠️ **ومن غير إعلان مابيرسمش حاجة — ولا مسافة.** خانة فاضية
 *    بهامش بتسيب فراغًا في نص الصفحة والزائر يفتكره عطل.
 *
 * ⚠️ **ومفيش علامة مائية على الإعلان.** العلامة بتتحط على أعمال
 *    الأطفال، وحطّها على صورة معلن بتبوّظ صورته وتوحّي إنها بتاعتنا.
 *
 * الاستعمال:
 *
 *     <AdSlot page="home" position="top" />
 */
export async function AdSlot({
  page,
  position,
  className = '',
}: {
  page: string;
  position: AdPosition;
  className?: string;
}) {
  const placement = placementKey(page, position);
  const ads = await getAdsForPlacement(placement, getServerNow());
  if (ads.length === 0) return null;

  return (
    <div className={`mx-auto w-full max-w-6xl px-4 ${position === 'top' ? 'mt-6' : 'mb-10'} ${className}`}>
      <AdSlider ads={ads} placement={placement} />
    </div>
  );
}
