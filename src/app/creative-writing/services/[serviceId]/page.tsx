import Link from 'next/link';
import { DependentRequestButton } from '@/components/services/DependentRequestButton';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { notFound } from 'next/navigation';
import { ArrowLeft, Award } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { getStandaloneServices, getProvidersForService } from '@/data/domains/services';
import { fetchFamilyMembers } from '@/app/actions/family';
import { PersonAvatar } from '@/components/ui/PersonAvatar';
import { pageMetadata } from '@/lib/seo';


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
    path: `/creative-writing/services/${service.id}`,
  });
}

/**
 * مقدّمو خدمة إبداعية واحدة، بالأرخص أولًا — والمقدّم ممكن يكون المنصة
 * نفسها أو مدربًا أو مستقلًا.
 * المعتمد والمفعّل بس هو اللي بيظهر — مفروض هنا، وتاني بصلاحيات
 * القاعدة على `provider_services`.
 */
export default async function ServiceProvidersPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  /**
   * بييجي من موافقة ولي الأمر على طلب ابنه.
   *
   * ⚠️ الموافقة كانت بتوديه على شاشة الطلب مباشرةً. دلوقتي بتوديه
   *    هنا — **أول المسار** — عشان يشوف كل المقدّمين واختيار ابنه
   *    معلَّم وسطهم، ويقدر يغيّره قبل ما يكمّل.
   */
  searchParams: Promise<{ child?: string; provider?: string }>;
}) {
  const { serviceId } = await params;
  const { child: childParam, provider: requestedProviderId } = await searchParams;

  const services = await getStandaloneServices();
  const service = services.find((s) => s.id === serviceId);
  if (!service) notFound();

  const providers = await getProvidersForService(serviceId);

  // ⚠️ الاسم بيتحلّ من قايمة أبناء الداخل دلوقتي، فرقم طفل حد تاني
  //    بيتجاهل بلا أي تسريب.
  const family = childParam ? await fetchFamilyMembers() : [];
  const presetChild = family.find((c) => c.id === childParam) ?? null;

  // حساب الطفل التابع بيشوف زرار «اطلب من ولي أمرك» بدل زرار الشراء.
  //
  // الفحص بيرمي لو تعذّر التحقق (عشان الحارس يفشل **مقفولًا** مش
  // مفتوحًا). هنا صفحة عرض عامة، فالفشل بيتعامل معاه كـ«مش تابع»
  // والحارس الحقيقي في `createServiceOrder` هو اللي بيمنع فعليًا.
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
    <PageContainer className="py-12 space-y-12 md:py-16">
      <Section containerClassName="mx-auto w-full max-w-4xl pt-16 pb-10">
        {/* Top Navigation */}
        <div className="mb-8">
          <Link
            href="/creative-writing/services"
            className="inline-flex items-center gap-2 font-bold text-slate-500 transition-colors hover:text-emerald-600"
          >
            <ArrowLeft className="h-4 w-4 rotate-180" />
            كل الخدمات الإبداعية
          </Link>
        </div>

        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            مقدمو خدمة: {service.name}
          </h1>
        </div>
        <p className="mt-4 text-lg font-medium leading-relaxed text-slate-600">
          {service.description}
        </p>
        <p className="mt-2 text-sm font-bold text-slate-400">
          اختر مقدّم الخدمة الذي يناسبك. السعر يختلف من مقدّم لآخر.
        </p>

        {/* ولي الأمر لازم يعرف إنه بيكمّل طلب ابنه، ولمين الخدمة. */}
        {presetChild && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900">
              بتكمّل طلب {presetChild.fullName}
            </p>
            <p className="mt-1 text-sm font-medium text-amber-800">
              اختياره معلَّم تحت — راجعه وغيّره لو حبيت، والخدمة هتتسجّل باسمه.
            </p>
          </div>
        )}
      </Section>

      <Section containerClassName="mx-auto w-full max-w-4xl pb-24">
        {providers.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center">
            <p className="text-lg font-bold text-slate-500">
              لا يوجد مقدّمون متاحون لهذه الخدمة حالياً.
            </p>
            <p className="mt-2 text-slate-400">سيتم إضافة مقدمي الخدمة قريباً.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {providers.map((provider) => (
              <div
                key={provider.offerId}
                className="flex flex-wrap items-center gap-6 rounded-3xl border-2 border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                {/* الصورة كانت موجودة في القاعدة ومحدش بيطلبها هنا. */}
                <PersonAvatar
                  name={provider.displayName}
                  avatarUrl={provider.avatarUrl}
                  size={64}
                />

                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-800">{provider.displayName}</h2>
                    {presetChild && provider.providerId === requestedProviderId && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        اختيار {presetChild.fullName}
                      </span>
                    )}
                    {/* الزائر يستحق يعرف إن اللي هينفّذ هو فريق المنصة
                        نفسه مش مدرب مستقل. */}
                    {provider.kind === 'platform' && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        فريق المنصة
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                    {provider.bio}
                  </p>
                  {provider.yearsExperience > 0 && (
                    <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <Award className="h-4 w-4" />
                      {provider.yearsExperience} سنوات خبرة
                    </p>
                  )}
                </div>

                <div className="text-center">
                  <span className="block text-sm font-bold text-slate-400">السعر</span>
                  <span className="text-3xl font-black text-emerald-600">
                    {formatPrice(provider.price)}
                  </span>
                </div>

                {/*
                  حساب الطفل ممنوع من الشراء المباشر، فالزرار العادي كان
                  هيوديه لشاشة بترفضه. بدله بيبعت طلب لولي أمره.
                */}
                {isDependent ? (
                  <DependentRequestButton
                    kind="service"
                    serviceId={serviceId}
                    providerId={provider.providerId}
                    label="اطلب من ولي أمرك"
                  />
                ) : (
                  <Link
                    href={`/creative-writing/services/${serviceId}/order?provider=${provider.providerId}${presetChild ? `&child=${presetChild.id}` : ''}`}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 py-4 font-bold text-white shadow-md transition-colors hover:bg-amber-600"
                  >
                    اطلب من هذا المقدّم
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>


    </PageContainer>
  );
}
