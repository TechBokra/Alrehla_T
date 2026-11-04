import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2, Info, CalendarCheck, Users, FileText, Star } from 'lucide-react';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { formatPrice } from '@/lib/utils';
import { pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { ShareButton } from '@/components/share/ShareButton';
import {
  PackageBookButton,
  PackageCard,
  PackageCover,
  PackageStats,
  ageGroupLabel,
  packageHref,
  perSessionPrice,
  trackStyle,
} from '@/components/creative-writing/PackageCard';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
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

/**
 * ⚠️ قايمة فاضية عن قصد — الشرح في
 *    `creative-writing/services/[serviceId]/page.tsx`: المسار
 *    المتغيّر من غيرها مابيتخزّنش ولا مرة (مقيس على المنشور).
 */
export async function generateStaticParams() {
  return [];
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

/** خطوات الباقة — نفس اللي بيحصل فعلًا في الموقع من الحجز للتقييم. */
const STEPS = [
  { icon: Users, title: 'اختار مدربك', text: 'من المدربين المعتمدين في الباقة، ومعاه الموعد الأسبوعي اللي يناسبك.' },
  { icon: CalendarCheck, title: 'الجلسات بتتجدول', text: 'بعد تأكيد الدفع، كل الجلسات بتتحدد ومعاها رابط الدخول.' },
  { icon: FileText, title: 'تقرير بعد كل جلسة', text: 'المدرب بيكتب اللي اتعمل والخطوة الجاية، وبيوصلك على حسابك.' },
  { icon: Star, title: 'تقييم في الآخر', text: 'بعد آخر جلسة، تقدر تقيّم المدرب والتجربة.' },
];

export default async function PackageDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [pkg, all, content] = await Promise.all([findPackage(slug), getWritingPackages(), getSiteContent()]);
  if (!pkg) notFound();

  /* ⚠️ فحص الطفل التابع اتنقل لصفحة الحجز — الشرح في
   *    `creative-writing/packages/page.tsx`. الصفحة دي عامة
   *    بالكامل دلوقتي فبتتخزّن. */

  const style = trackStyle(pkg.track);
  const perSession = perSessionPrice(pkg);
  const trackTitle = pkg.track ? content[`packages.track.${pkg.track}.title`] : null;
  const siblings = all.filter((p) => p.isActive && p.id !== pkg.id && p.track && p.track === pkg.track);
  const prerequisite = pkg.prerequisitePackageId
    ? all.find((p) => p.isActive && p.id === pkg.prerequisitePackageId)
    : undefined;

  return (
    <PageContainer className="!py-0 !space-y-0">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'بداية الرحلة', path: '/creative-writing' },
          { name: 'الباقات', path: '/creative-writing/packages' },
          { name: pkg.name, path: packageHref(pkg) },
        ])}
      />

      {/* ── الواجهة: الصورة + الملخص والحجز ───────────────────── */}
      <Section containerClassName="pt-8 pb-12">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href="/creative-writing/packages"
            className="mb-6 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-emerald-700"
          >
            <ArrowRight className="h-4 w-4" />
            كل الباقات
          </Link>

          <div className="grid items-start gap-8 lg:grid-cols-5">
            <PackageCover
              pkg={pkg}
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="aspect-[16/10] rounded-3xl lg:col-span-3"
            />

            <div className="space-y-6 lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                {trackTitle && (
                  <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${style.chip}`}>{trackTitle}</span>
                )}
                <span className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-bold text-slate-600">
                  {ageGroupLabel(pkg.ageGroup)}
                </span>
                {pkg.bookingOpen === false && (
                  <span className="rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold text-white">قريبًا</span>
                )}
              </div>

              <div>
                <h1 className="text-3xl font-black text-slate-900 md:text-4xl">{pkg.name}</h1>
                {pkg.shortDescription && (
                  <p className="mt-3 text-lg leading-relaxed font-bold text-slate-600">{pkg.shortDescription}</p>
                )}
              </div>

              <PackageStats pkg={pkg} />

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500">سعر الباقة كاملة</div>
                    <div className="text-3xl font-black text-slate-900">{formatPrice(pkg.price)}</div>
                  </div>
                  {perSession !== null && (
                    <div className="text-left text-xs font-bold text-slate-500">
                      حوالي <span className="text-sm font-black text-slate-700">{formatPrice(perSession)}</span>
                      <br />
                      للجلسة
                    </div>
                  )}
                </div>
                <PackageBookButton pkg={pkg} className="w-full" />
                <div className="mt-3 flex justify-center">
                  <ShareButton
                    variant="subtle"
                    theme="emerald"
                    label="شارك الباقة"
                    data={{ title: pkg.name, description: pkg.shortDescription, url: packageHref(pkg) }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── التفاصيل + إزاي بتمشي ─────────────────────────────── */}
      <Section containerClassName="pb-16">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {pkg.fullDescription && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
                <h2 className="mb-4 text-2xl font-black text-slate-900">عن الباقة</h2>
                {/* نص عادي من اللوحة — السطور الجديدة بتتحترم. */}
                <p className="text-lg leading-loose font-medium whitespace-pre-line text-slate-700">
                  {pkg.fullDescription}
                </p>
              </section>
            )}

            {pkg.targetAudience && (
              <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 md:p-8">
                <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-900">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                  لمن تناسب؟
                </h2>
                <p className="text-lg leading-loose font-medium whitespace-pre-line text-slate-700">
                  {pkg.targetAudience}
                </p>
              </section>
            )}

            {(pkg.prerequisiteNote || prerequisite) && (
              <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <Info className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                <div className="space-y-2 text-sm leading-relaxed font-medium text-slate-700">
                  {pkg.prerequisiteNote && <p>{pkg.prerequisiteNote}</p>}
                  {prerequisite && (
                    <p>
                      الباقة اللي قبلها:{' '}
                      <Link href={packageHref(prerequisite)} className="font-bold text-emerald-700 hover:underline">
                        {prerequisite.name}
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="mb-5 text-lg font-black text-slate-900">إزاي بتمشي الباقة</h2>
              <ol className="space-y-5">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${style.accent}`}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-bold text-slate-800">
                          {(i + 1).toLocaleString('ar-EG')}. {step.title}
                        </p>
                        <p className="text-sm leading-relaxed font-medium text-slate-500">{step.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </div>
      </Section>

      {/* ── الباقة التانية في نفس المسار — للمقارنة ─────────────── */}
      {siblings.length > 0 && (
        <Section containerClassName="pb-24">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="mb-6 text-2xl font-black text-slate-900">
              {siblings.length === 1 ? 'الباقة التانية في نفس المسار' : 'باقات تانية في نفس المسار'}
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {siblings.map((p) => (
                <PackageCard key={p.id} pkg={p} />
              ))}
            </div>
          </div>
        </Section>
      )}
    </PageContainer>
  );
}
