import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getOrders } from '@/data/domains/(client)/orders/queries';
import { getMyImageReviews } from '@/data/domains/(client)/story-preview/queries';
import { getProductNamesFor } from '@/data/domains/(shared)/products/queries';
import { awaitingImageCount, latestImagePerItem } from '@/lib/image-review';
import { REVIEW_DELAY_NOTE } from '@/lib/delivery-days';
import { pageMetadata } from '@/lib/seo';
import { ImageReviewCard } from './ImageReviewClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'صورة البطل',
    description: 'شوف صورة البطل ووافق عليها قبل الرسم.',
    path: '/account/orders/enha-lak',
    noIndex: true,
  });
}

/**
 * مراجعة ولي الأمر لصورة البطل — قرار تامر (٢٥ أكتوبر): «المراجعة
 * بتكون للصورة فقط».
 *
 * ⚠️ `getOrders` بيقرا طلبات الداخل بس (طبقة أولى)، و
 *    `my_story_image_reviews` في القاعدة بتفلتر على صاحب الطلب.
 */
export default async function StoryPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const orders = await getOrders();
  const order = orders.find((o) => o.id === id);
  if (!order) notFound();

  const rows = await getMyImageReviews(id);
  const latest = latestImagePerItem(rows);
  const awaiting = awaitingImageCount(rows);

  const names = await getProductNamesFor(latest.map((r) => r.productId).filter(Boolean));

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="صورة البطل" backHref="/account/orders/enha-lak" />

      {awaiting > 0 && (
        <p
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 font-bold text-amber-900"
        >
          {awaiting === 1 ? 'صورة مستنية' : `${awaiting.toLocaleString('ar-EG')} صور مستنية`} موافقتك — الرسم
          مابيبدأش قبلها، وأي تأخير في الاعتماد بيأخّر ميعاد التسليم.
        </p>
      )}

      {latest.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-black text-slate-800">لسه صورة البطل ماجهزتش</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-600">
            فريقنا بيكتب القصة ويرسم البطل الأول، وأول ما الصورة تجهز هنبعتلك إشعارًا تشوفها وتوافق.
            {' '}
            {REVIEW_DELAY_NOTE}
          </p>
          <Link
            href="/account/orders/enha-lak"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-6 font-bold text-white hover:bg-slate-800"
          >
            رجوع لطلباتي
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {latest.map((row) => (
            <ImageReviewCard
              key={row.reviewId}
              row={row}
              orderId={id}
              productName={names[row.productId] ?? 'قصة مخصّصة'}
              delayNote={REVIEW_DELAY_NOTE}
            />
          ))}
        </div>
      )}
    </div>
  );
}
