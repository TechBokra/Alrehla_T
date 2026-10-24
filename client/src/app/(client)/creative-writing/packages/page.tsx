import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'باقات بداية الرحلة',
    description: 'باقات الكتابة الإبداعية في منصة الرحلة: عدد الجلسات ومدتها وسعر كل باقة.',
    path: '/creative-writing/packages',
  });
}

import Link from 'next/link';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { PackageCard, trackStyle } from '@/components/creative-writing/PackageCard';
import { PageContainer } from '@/components/PageContainer';
import { PageHero } from '@/components/PageHero';
import { SectionTabs } from '@/components/SectionTabs';
import { SectionHeader } from '@/components/SectionHeader';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getWatermarkLayer } from '@/lib/watermark';
import { AdSlot } from '@/components/ads/AdSlot';


export default async function PackagesPage() {
  const [packages, content, settings, wm] = await Promise.all([
    getWritingPackages(),
    getSiteContent(),
    getSiteSettings(),
    getWatermarkLayer(),
  ]);

  /* ⚠️ **فحص الطفل التابع اتنقل لصفحة الحجز** (`booking/page.tsx`).
   *
   *    كان هنا، والصفحة بتقرا المستخدم عشانه فبتتبني لكل زيارة:
   *    **٨٨٨ مللي** بالقياس على المنشور، مقابل **١٢٠** للصفحة
   *    المتخزّنة. والفحص بيخص أقلية من الزوّار.
   *
   *    وصفحة الحجز بتتبني لكل زيارة أصلًا، والفحص هناك بيوقف الطفل
   *    **قبل** المعالج — نفس الحماية، وبلا تكلفة على الباقي.
   */

  const activePackages = packages.filter((p) => p.isActive);

  /**
   * التقسيم بقى بالمسار مش بالسن.
   *
   * السبب: مسار اليافعين ومسار التخصص **نفس الفئة العمرية**، فالسن
   * ما بيفرّقش بينهم. والفئة العمرية بتفضل ظاهرة كتوضيح على الكارت.
   *
   * وأي باقة لسه بلا مسار بتظهر في مجموعة أخيرة بدل ما تختفي من الصفحة
   * زي ما كان بيحصل قبل كده.
   */
  const tracks = [
    {
      key: 'foundation' as const,
      title: content['packages.track.foundation.title'],
      subtitle: content['packages.track.foundation.subtitle'],
    },
    {
      key: 'youth' as const,
      title: content['packages.track.youth.title'],
      subtitle: content['packages.track.youth.subtitle'],
    },
    {
      key: 'specialization' as const,
      title: content['packages.track.specialization.title'],
      subtitle: content['packages.track.specialization.subtitle'],
    },
  ].map((t) => ({ ...t, items: activePackages.filter((p) => p.track === t.key) }));

  const untracked = activePackages.filter((p) => !p.track);

  // التبويبات بتتبنى من المسارات اللي **فيها باقات فعلًا** — تبويب
  // بيودّي على قسم فاضي أسوأ من إنه مايظهرش.
  const tabItems = [
    ...tracks.filter((t) => t.items.length > 0).map((t) => ({ id: t.key, label: t.title })),
    ...(untracked.length > 0 ? [{ id: 'other', label: content['packages.otherTitle'] }] : []),
  ];

  return (
    <>
      <PageHero
        image={settings.images.packagesHero}
        watermark={wm}
        title={content['packages.title']}
        subtitle={content['packages.description']}
        bandClassName="bg-emerald-50"
      />
      <AdSlot page="packages" position="top" />
      <PageContainer className="!py-0 !space-y-0">
        <SectionTabs items={tabItems} />

      <div className="mx-auto w-full max-w-5xl space-y-16 pb-20">
        {tracks
          .filter((track) => track.items.length > 0)
          .map((track, idx) => {
            const style = trackStyle(track.key);
            return (
              <Section key={track.key} id={track.key} className="scroll-mt-24">
                {/* رأس المسار: رقم ولون — المسارات خطوات في رحلة، مش قايمة. */}
                <div className="mb-8 flex items-start gap-4">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-sm ${style.accent}`}
                    aria-hidden="true"
                  >
                    {(idx + 1).toLocaleString('ar-EG')}
                  </span>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 md:text-3xl">{track.title}</h2>
                    <p className="mt-1 font-medium text-slate-500">{track.subtitle}</p>
                  </div>
                </div>
                <div className={`grid gap-6 md:grid-cols-2 ${track.items.length > 2 ? 'lg:grid-cols-3' : ''}`}>
                  {track.items.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </Section>
            );
          })}

        {untracked.length > 0 && (
          <Section id="other" className="scroll-mt-24">
            <div className="mb-10 text-center md:text-right">
              <h2 className="text-3xl font-black text-slate-800">{content['packages.otherTitle']}</h2>
              <p className="mt-2 font-medium text-slate-500">
                {content['packages.otherSubtitle']}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {untracked.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Help Link */}
      <Section containerClassName="pb-16">
        <Card accentColor="emerald" className="mx-auto w-full max-w-4xl p-6 text-center bg-slate-50">
          <p className="text-lg font-medium text-slate-600">
            {content['packages.help.text']}{' '}
            <Link
              href="/support"
              className="font-bold text-emerald-700 hover:underline"
            >
              {content['packages.help.link']}
            </Link>
          </p>
        </Card>
      </Section>


    <AdSlot page="packages" position="bottom" />
    </PageContainer>
    </>
  );
}
