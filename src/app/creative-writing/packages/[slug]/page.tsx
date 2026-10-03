import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { getWritingPackages } from '@/data/domains/writing';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { formatPrice } from '@/lib/utils';
import { pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import {
  PackageBookButton,
  PackageStats,
  ageGroupLabel,
  packageHref,
} from '@/components/creative-writing/PackageCard';
import type { WritingPackage } from '@/types';

/**
 * صفحة تفاصيل الباقة — الوصف الكامل ولمن تناسب والملاحظات.
 *
 * ⚠️ **الوصف الكامل كان بيتكتب في اللوحة ومابيظهرش في أي مكان.** الكارت
 *    في صفحة الباقات بقى مختصر، والتفاصيل كلها هنا. (ملاحظة فريق العمل.)
 *
 * ⚠️ الرابط بالـ`slug`، ولو الباقة مالهاش (قديمة) بالـ`id` — نفس
 *    `packageHref` اللي الكارت بيستعمله.
 */

async function findPackage(param: string): Promise<WritingPackage | null> {
  const key = decodeURIComponent(param);
  const all = await getWritingPackages();
  // الموقوفة مابتظهرش للزائر — نفس فلتر صفحة الباقات.
  return all.find((p) => p.isActive && (p.slug === key || p.id === key)) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pkg = await findPackage(slug);
  if (!pkg) return { title: 'باقة غير موجودة' };
  return pageMetadata({
    title: `${pkg.name} — باقات بداية الرحلة`,
    description:
      pkg.shortDescription ||
      `باقة ${pkg.name}: ${pkg.sessionsCount} جلسة كتابة إبداعية فردية على منصة الرحلة.`,
    path: packageHref(pkg),
  });
}

export default async function PackageDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pkg = await findPackage(slug);
  if (!pkg) notFound();

  // حساب الطفل التابع بيشوف «اطلب من ولي أمرك» بدل زرار الحجز. الفشل هنا
  // = «مش تابع»: صفحة عرض، والحارس الحقيقي في `createCourseBooking`.
  const user = await getCurrentUser();
  let isDependent = false;
  if (user.role !== 'visitor') {
    try {
      isDependent = Boolean(await getDependentGuardian());
    } catch {
      isDependent = false;
    }
  }

  return (
    <PageContainer className="!py-0 !space-y-0">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'بداية الرحلة', path: '/creative-writing' },
          { name: 'الباقات', path: '/creative-writing/packages' },
          { name: pkg.name, path: packageHref(pkg) },
        ])}
      />
      <Section containerClassName="pt-8 pb-20">
        <div className="mx-auto w-full max-w-4xl space-y-8">
          <Link
            href="/creative-writing/packages"
            className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-emerald-700"
          >
            <ArrowRight className="h-4 w-4" />
            كل الباقات
          </Link>

          <Card accentColor="emerald" className="space-y-6 p-6 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-800 md:text-4xl">{pkg.name}</h1>
                <span className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                  {ageGroupLabel(pkg.ageGroup)}
                </span>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-xl font-black text-emerald-700">
                {formatPrice(pkg.price)}
              </div>
            </div>

            {pkg.shortDescription && (
              <p className="text-lg leading-relaxed font-bold text-slate-700">{pkg.shortDescription}</p>
            )}

            <PackageStats pkg={pkg} size="lg" />

            {pkg.fullDescription && (
              <div>
                <h2 className="mb-3 text-xl font-black text-slate-800">عن الباقة</h2>
                {/* نص عادي من اللوحة — السطور الجديدة بتتحترم. */}
                <p className="leading-loose font-medium whitespace-pre-line text-slate-600">
                  {pkg.fullDescription}
                </p>
              </div>
            )}

            {pkg.targetAudience && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-black text-slate-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  لمن تناسب؟
                </h2>
                <p className="leading-loose font-medium whitespace-pre-line text-slate-600">
                  {pkg.targetAudience}
                </p>
              </div>
            )}

            {pkg.prerequisiteNote && (
              <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <Info className="h-5 w-5 shrink-0 text-slate-400" />
                <p className="text-sm leading-relaxed font-medium text-slate-700">{pkg.prerequisiteNote}</p>
              </div>
            )}

            <PackageBookButton pkg={pkg} isDependent={isDependent} className="w-full md:w-auto md:px-10" />
          </Card>
        </div>
      </Section>
    </PageContainer>
  );
}
