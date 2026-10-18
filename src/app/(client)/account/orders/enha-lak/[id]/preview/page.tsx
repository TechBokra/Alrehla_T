import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getOrders } from '@/data/domains/(client)/orders/queries';
import { getMyStoryPreviews } from '@/data/domains/(client)/story-preview/queries';
import { getProductNamesFor } from '@/data/domains/(shared)/products/queries';
import { latestPerItem, awaitingCount } from '@/lib/story-preview';
import { pageMetadata } from '@/lib/seo';
import { StoryPreviewCard } from './StoryPreviewClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'معاينة النص',
    description: 'اقرا نص القصة وقول لنا رأيك قبل الرسم.',
    path: '/account/orders/enha-lak',
    noIndex: true,
  });
}

/**
 * معاينة نص القصة وموافقة ولي الأمر — أكبر بند في دراسة المقارنة.
 *
 * ⚠️ **`getOrders` بيقرا طلبات الداخل بس**، فطلب حد تاني = «غير
 *    موجود». ودي طبقة أولى: الطبقة الحقيقية إن
 *    `my_story_previews` في القاعدة بتفلتر على `o.user_id =
 *    auth.uid()` — فحتى لو الفحص ده اتشال، مفيش نص بيطلع.
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

  const rows = await getMyStoryPreviews(id);
  const latest = latestPerItem(rows);
  const awaiting = awaitingCount(latest);

  const names = await getProductNamesFor(latest.map((r) => r.productId).filter(Boolean));

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="معاينة النص" backHref="/account/orders/enha-lak" />

      {awaiting > 0 && (
        <p
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 font-bold text-amber-900"
        >
          {awaiting.toLocaleString('ar-EG')} {awaiting === 1 ? 'نص' : 'نصوص'} مستنية موافقتك —
          الرسم مابيبدأش قبلها.
        </p>
      )}

      {latest.length === 0 ? (
        /* ⚠️ الفراغ هنا معناه «لسه»، مش «مفيش». العميل اللي
            بيوصل من رابط قديم أو من فضول لازم يعرف الفرق —
            وإلا بيفتكر إن فيه حاجة باظت. */
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-black text-slate-800">لسه مفيش نص جاهز للمعاينة</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-600">
            المحرّر بيكتب القصة الأول، وأول ما تخلص هنبعتلك إشعارًا تقراها وتقول رأيك.
            الرسم مابيبدأش قبل موافقتك.
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
            <StoryPreviewCard
              key={row.versionId}
              row={row}
              productName={names[row.productId] ?? 'قصة مخصّصة'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
