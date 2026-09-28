import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'باقات بداية الرحلة',
    description: 'باقات الكتابة الإبداعية في منصة الرحلة: عدد الجلسات ومدتها وسعر كل باقة.',
    path: '/creative-writing/packages',
  });
}

import { formatPrice } from '@/lib/utils';
import Link from 'next/link';
import { getWritingPackages } from '@/data/domains/writing';
import { Target, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { WritingPackage } from '@/types';

import { DependentRequestButton } from '@/components/services/DependentRequestButton';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { PageContainer } from '@/components/PageContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
      title: 'مسار التأسيس',
      subtitle: 'دون 12 سنة',
    },
    {
      key: 'youth' as const,
      title: 'مسار اليافعين والكبار',
      subtitle: '12 سنة فأعلى',
    },
    {
      key: 'specialization' as const,
      title: 'مسار التخصص',
      subtitle: '12 سنة فأعلى — لمن أنهى مسارًا سابقًا أو يكتب بالفعل',
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
              <div className="grid gap-8 lg:grid-cols-2">
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
                لم يُحدَّد مسارها بعد
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
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
            غير متأكد أي باقة تناسبك؟{' '}
            <Link
              href="/support"
              className="font-bold text-emerald-600 hover:underline"
            >
              تواصل معنا وسنساعدك على فهم الفروق قبل الحجز.
            </Link>
          </p>
        </Card>
      </Section>


    </PageContainer>
  );
}

function PackageCard({ pkg, isDependent }: { pkg: WritingPackage; isDependent: boolean }) {
  return (
    <Card accentColor="emerald" className="flex flex-col p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black text-slate-800">{pkg.name}</h3>
          {/* الفئة العمرية توضيح للأهل، مش شرط بيتفحص: الباقة متاحة للحجز
              في كل الأحوال. */}
          <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            {pkg.ageGroup === 'under_12' ? 'مناسبة لأقل من 12 سنة' : 'مناسبة لـ 12 سنة فأكثر'}
          </span>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-2 font-black text-emerald-700">
          {formatPrice(pkg.price)}
        </div>
      </div>

      <div
        className={`grid ${pkg.sessionDuration ? 'grid-cols-3' : 'grid-cols-2'} mb-8 gap-4`}
      >
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <Calendar className="mx-auto mb-2 h-5 w-5 text-slate-400" />
          <div className="text-xs font-medium text-slate-500">المدة</div>
          <div className="text-sm font-bold text-slate-800">
            {/* الخانة بتفضل ظاهرة حتى لو المدة مش متسجّلة، عشان الكروت
                ما تبقاش مختلفة الشكل من باقة للتانية. */}
            {pkg.durationText || '—'}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <Target className="mx-auto mb-2 h-5 w-5 text-slate-400" />
          <div className="text-xs font-medium text-slate-500">الجلسات</div>
          <div className="text-sm font-bold text-slate-800">
            {pkg.sessionsCount} جلسة
          </div>
        </div>
        {pkg.sessionDuration && (
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <Clock className="mx-auto mb-2 h-5 w-5 text-slate-400" />
            <div className="text-xs font-medium text-slate-500">مدة الجلسة</div>
            <div className="text-sm font-bold text-slate-800">
              {pkg.sessionDuration}
            </div>
          </div>
        )}
      </div>

      <div className="mb-8 flex-1 space-y-6">
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            لمن تناسب؟
          </h4>
          <p className="text-sm leading-relaxed font-medium text-slate-600">
            {pkg.targetAudience}
          </p>
        </div>

        {pkg.prerequisiteNote && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h4 className="mb-1 text-xs font-bold tracking-wider text-slate-500 uppercase">
              ملاحظة
            </h4>
            <p className="text-sm leading-relaxed font-medium text-slate-700">
              {pkg.prerequisiteNote}
            </p>
          </div>
        )}
      </div>

      {/*
        حساب الطفل التابع ممنوع من الحجز المباشر. من غير الزرار ده كان
        بيوصل للمعالج ويكمّل لحد آخر خطوة وبعدين ياخد رسالة منع — طريق
        مسدود بعد شغل. دلوقتي بيطلب من ولي أمره من هنا.
      */}
      {isDependent ? (
        <div className="mt-auto w-full">
          <DependentRequestButton
            kind="package"
            packageId={pkg.id}
            label="اطلب الباقة من ولي أمرك"
          />
        </div>
      ) : (
        <Button
          // الباقة بتتبعت في الرابط: قبل كده كان اللي بيختار باقة معيّنة
          // يوصل للمعالج وهو مختار أول باقة في القايمة.
          href={`/creative-writing/booking?package=${encodeURIComponent(pkg.id)}`}
          accentColor="emerald"
          className="mt-auto w-full py-4 text-center"
        >
          اكتشف المدربين والأسعار
        </Button>
      )}
    </Card>
  );
}
