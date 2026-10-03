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
import { getWritingPackages } from '@/data/domains/writing';
import { PackageCard } from '@/components/creative-writing/PackageCard';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { PageContainer } from '@/components/PageContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { getSiteContent } from '@/data/domains/content';


export default async function PackagesPage() {
  const [packages, content] = await Promise.all([getWritingPackages(), getSiteContent()]);

  // حساب الطفل التابع بيشوف «اطلب من ولي أمرك» بدل زرار الحجز.
  // الفشل هنا بيتعامل معاه كـ«مش تابع» — صفحة عرض، والحارس الحقيقي
  // في `createCourseBooking`.
  const user = await getCurrentUser();
  let isDependent = false;
  if (user.role !== 'visitor') {
    try {
      isDependent = Boolean(await getDependentGuardian());
    } catch {
      isDependent = false;
    }
  }

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

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Header */}
      <Section containerClassName="pt-8 pb-12">
        <SectionHeader
          title={content['packages.title']}
          description={content['packages.description']}
        />

      </Section>

      <div className="mx-auto w-full max-w-6xl space-y-20 pb-20">
        {tracks.map((track) =>
          track.items.length === 0 ? null : (
            <Section key={track.key}>
              <div className="mb-10 text-center md:text-right">
                <h2 className="text-3xl font-black text-slate-800">{track.title}</h2>
                <p className="mt-2 font-medium text-slate-500">{track.subtitle}</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {track.items.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} isDependent={isDependent} />
                ))}
              </div>
            </Section>
          ),
        )}

        {untracked.length > 0 && (
          <Section>
            <div className="mb-10 text-center md:text-right">
              <h2 className="text-3xl font-black text-slate-800">{content['packages.otherTitle']}</h2>
              <p className="mt-2 font-medium text-slate-500">
                {content['packages.otherSubtitle']}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {untracked.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} isDependent={isDependent} />
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


    </PageContainer>
  );
}
