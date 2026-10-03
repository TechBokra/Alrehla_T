import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Award, CheckCircle2, Clock, ClipboardList } from 'lucide-react';
import { DependentRequestButton } from '@/components/services/DependentRequestButton';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { formatPrice } from '@/lib/utils';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { getStandaloneServices, getProvidersForService } from '@/data/domains/services';
import { fetchFamilyMembers } from '@/app/actions/family';
import { PersonAvatar } from '@/components/ui/PersonAvatar';
import { pageMetadata } from '@/lib/seo';
import { getWatermarkLayer } from '@/lib/watermark';
import { addWatermark, optimizedImageUrl } from '@/lib/cloudinary';
import { deliveryLabel } from '@/lib/service-details';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';
import { ShareButton } from '@/components/share/ShareButton';
import {
  ServiceSteps,
  categoryStyle,
  serviceHref,
} from '@/components/creative-writing/ServiceCard';
import { ServiceSamples } from '@/components/creative-writing/ServiceSamples';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const services = await getStandaloneServices();
  const service = services.find((s) => s.id === serviceId);
  if (!service) return { title: 'خدمة غير موجودة' };
  return pageMetadata({
    title: service.name,
    description:
      service.description ||
      `${service.name} — خدمة إبداعية على منصة الرحلة، اختر المدرب المناسب وابدأ.`,
    path: serviceHref(service.id),
    image: service.coverImageUrl,
  });
}

/**
 * صفحة الخدمة الإبداعية — التفاصيل والنماذج والطلب (ملف 09).
 *
 * ── قبلها ───────────────────────────────────────────────────
 *
 * الصفحة دي كانت «مقدمو خدمة: …» — عنوان وسطر وصف وقايمة مقدّمين. يعني
 * العميل بيختار **مين** قبل ما يعرف **إيه**: مفيش صورة ولا «هتاخد إيه» ولا
 * مدة تسليم. (ملاحظة تامر: «أضعف جزء في الموقع».)
 *
 * ── دلوقتي ──────────────────────────────────────────────────
 *
 * الخدمة الأول (صورة، وصف، هتاخد إيه، محتاجين منك، نماذج)، وزرار طلب
 * واحد واضح — ومثبّت تحت على الموبايل. ولو فيه أكتر من مقدّم، الاختيار
 * بينهم في آخر الصفحة.
 *
 * ⚠️ السعر من المقدّم المعتمد — نفس مصدر الخادم (`getProvidersForService`).
 */
export default async function ServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  /**
   * بييجي من موافقة ولي الأمر على طلب ابنه: الطفل متحدد، واختياره للمقدّم
   * متعلَّم — وولي الأمر يقدر يغيّره قبل ما يكمّل.
   */
  searchParams: Promise<{ child?: string; provider?: string }>;
}) {
  const { serviceId } = await params;
  const { child: childParam, provider: requestedProviderId } = await searchParams;

  const services = await getStandaloneServices();
  const service = services.find((s) => s.id === serviceId);
  if (!service) notFound();

  const [providers, wm] = await Promise.all([
    getProvidersForService(serviceId),
    getWatermarkLayer(),
  ]);

  // ⚠️ الاسم بيتحلّ من قايمة أبناء الداخل، فرقم طفل حد تاني بيتجاهل.
  const family = childParam ? await fetchFamilyMembers() : [];
  const presetChild = family.find((c) => c.id === childParam) ?? null;

  // حساب الطفل التابع بيشوف «اطلب من ولي أمرك» بدل زرار الشراء. الفشل =
  // «مش تابع»: صفحة عرض، والحارس الحقيقي في `createServiceOrder`.
  const user = await getCurrentUser();
  let isDependent = false;
  if (user.role !== 'visitor') {
    try {
      isDependent = Boolean(await getDependentGuardian());
    } catch {
      isDependent = false;
    }
  }

  const style = categoryStyle(service.category);
  const Icon = style.icon;
  const cover = service.coverImageUrl
    ? addWatermark(optimizedImageUrl(service.coverImageUrl, 1200), wm)
    : null;
  const samples = (service.galleryImageUrls ?? []).map((u) =>
    addWatermark(optimizedImageUrl(u, 1200), wm),
  );
  const delivery = deliveryLabel(service.deliveryDays);

  const prices = providers.map((p) => p.price);
  const available = providers.length > 0;
  const single = providers.length === 1 ? providers[0] : null;
  const startsFrom = service.priceType === 'starts_from' || new Set(prices).size > 1;
  const price = available ? Math.min(...prices) : service.price;

  const orderHref = (providerId: string) =>
    `/creative-writing/services/${encodeURIComponent(serviceId)}/order?provider=${encodeURIComponent(providerId)}${
      presetChild ? `&child=${encodeURIComponent(presetChild.id)}` : ''
    }`;

  /** زرار الطلب الأساسي — نفس المنطق فوق وفي الشريط المثبّت تحت. */
  const primaryAction = (className = '') => {
    if (!available) {
      return (
        <span className={`flex min-h-[52px] items-center justify-center rounded-xl bg-slate-200 px-6 font-bold text-slate-600 ${className}`}>
          قريبًا
        </span>
      );
    }
    if (single && isDependent) {
      return (
        <div className={className}>
          <DependentRequestButton
            kind="service"
            serviceId={serviceId}
            providerId={single.providerId}
            label="اطلب من ولي أمرك"
          />
        </div>
      );
    }
    if (single) {
      return (
        <Link
          href={orderHref(single.providerId)}
          className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 font-black text-white shadow-md transition-colors hover:bg-emerald-800 ${className}`}
        >
          اطلب الخدمة
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
      );
    }
    return (
      <a
        href="#providers"
        className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 font-black text-white shadow-md transition-colors hover:bg-emerald-800 ${className}`}
      >
        اختار مقدّم الخدمة
        <ArrowLeft className="h-5 w-5 -rotate-90" aria-hidden="true" />
      </a>
    );
  };

  return (
    <PageContainer className="!py-0 !space-y-0 pb-24 lg:pb-0">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'بداية الرحلة', path: '/creative-writing' },
          { name: 'الخدمات الإبداعية', path: '/creative-writing/services' },
          { name: service.name, path: serviceHref(service.id) },
        ])}
      />

      <Section containerClassName="mx-auto w-full max-w-6xl pt-10 pb-8">
        <Link
          href="/creative-writing/services"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
          كل الخدمات الإبداعية
        </Link>

        <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-slate-200 ${style.tint}`}>
            {cover ? (
              <Image
                src={cover}
                alt={service.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Icon className={`h-24 w-24 ${style.text} opacity-60`} aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            {service.category && (
              <Link
                href={`/creative-writing/services?category=${encodeURIComponent(service.category)}`}
                className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${style.tint} ${style.text}`}
              >
                {service.category}
              </Link>
            )}
            <h1 className="text-3xl leading-tight font-black text-slate-900 md:text-4xl">{service.name}</h1>
            {service.description && (
              <p className="text-lg leading-relaxed font-medium text-slate-600">{service.description}</p>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-slate-50 p-4">
              <div>
                <span className="block text-sm font-bold text-slate-500">{startsFrom ? 'يبدأ من' : 'السعر'}</span>
                <span className="text-3xl font-black text-slate-900">{formatPrice(price)}</span>
              </div>
              {delivery && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {delivery}
                </span>
              )}
            </div>

            {single && (
              <div className="flex items-center gap-3">
                <PersonAvatar name={single.displayName} avatarUrl={single.avatarUrl} size={40} />
                <p className="text-sm font-bold text-slate-700">
                  بيقدّمها: {single.displayName}
                  {single.kind === 'platform' && (
                    <span className="mr-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                      فريق المنصة
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* ولي الأمر لازم يعرف إنه بيكمّل طلب ابنه، ولمين الخدمة. */}
            {presetChild && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-bold text-amber-900">بتكمّل طلب {presetChild.fullName}</p>
                <p className="mt-1 text-sm font-medium text-amber-800">
                  الخدمة هتتسجّل باسمه، وتقدر تغيّر مقدّم الخدمة قبل ما تكمّل.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {primaryAction('w-full sm:flex-1')}
              <ShareButton
                variant="subtle"
                theme="emerald"
                label="شارك"
                className="min-h-[52px]"
                data={{
                  title: service.name,
                  description: service.description,
                  url: serviceHref(service.id),
                  shortPath: `/s/s/${service.id}`,
                }}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section containerClassName="mx-auto w-full max-w-6xl pb-16">
        <div className="grid items-start gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-10">
            {(service.longDescription || service.description) && (
              <section>
                <h2 className="mb-3 text-2xl font-black text-slate-800">عن الخدمة</h2>
                <p className="leading-loose font-medium whitespace-pre-line text-slate-700">
                  {service.longDescription || service.description}
                </p>
              </section>
            )}

            {service.deliverables && service.deliverables.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl font-black text-slate-800">هتاخد إيه</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {service.deliverables.map((d) => (
                    <li key={d} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                      <span className="font-medium text-slate-700">{d}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {samples.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl font-black text-slate-800">نماذج من شغلنا</h2>
                <ServiceSamples images={samples} alt={service.name} />
              </section>
            )}

            {providers.length > 1 && (
              <section id="providers" className="scroll-mt-28">
                <h2 className="mb-2 text-2xl font-black text-slate-800">اختار مقدّم الخدمة</h2>
                <p className="mb-4 text-sm font-medium text-slate-500">السعر بيختلف من مقدّم للتاني.</p>
                <ul className="flex flex-col gap-3">
                  {providers.map((provider) => (
                    <li
                      key={provider.offerId}
                      className={`flex flex-wrap items-center gap-4 rounded-2xl border-2 bg-white p-5 ${
                        presetChild && provider.providerId === requestedProviderId
                          ? 'border-amber-300'
                          : 'border-slate-100'
                      }`}
                    >
                      <PersonAvatar name={provider.displayName} avatarUrl={provider.avatarUrl} size={56} />
                      <div className="min-w-[180px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-slate-800">{provider.displayName}</h3>
                          {presetChild && provider.providerId === requestedProviderId && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                              اختيار {presetChild.fullName}
                            </span>
                          )}
                          {provider.kind === 'platform' && (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                              فريق المنصة
                            </span>
                          )}
                        </div>
                        {provider.bio && (
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-600">{provider.bio}</p>
                        )}
                        {provider.yearsExperience > 0 && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                            <Award className="h-4 w-4" aria-hidden="true" />
                            {provider.yearsExperience} سنوات خبرة
                          </p>
                        )}
                      </div>
                      <span className="text-2xl font-black text-slate-900">{formatPrice(provider.price)}</span>
                      {isDependent ? (
                        <DependentRequestButton
                          kind="service"
                          serviceId={serviceId}
                          providerId={provider.providerId}
                          label="اطلب من ولي أمرك"
                        />
                      ) : (
                        <Link
                          href={orderHref(provider.providerId)}
                          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 font-bold text-white transition-colors hover:bg-emerald-800"
                        >
                          اطلب
                          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-28">
            {service.requirements && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-amber-900">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                  محتاجين منك إيه
                </h2>
                <p className="text-sm leading-relaxed font-medium whitespace-pre-line text-amber-900">
                  {service.requirements}
                </p>
              </section>
            )}
            <section>
              <h2 className="mb-3 text-lg font-black text-slate-800">إزاي بتشتغل؟</h2>
              <ServiceSteps compact />
            </section>
          </aside>
        </div>
      </Section>

      {/* الشريط المثبّت على الموبايل — الطلب دايمًا تحت إيد العميل وهو بيقرا. */}
      {available && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="shrink-0">
              {startsFrom && <span className="block text-[11px] font-bold text-slate-500">يبدأ من</span>}
              <span className="text-lg font-black text-slate-900">{formatPrice(price)}</span>
            </div>
            {primaryAction('flex-1')}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
