import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// صفحة داخل مسار الشراء: مالهاش لازمة في نتايج البحث، والرابط القانوني
// بيوجّه للصفحة العامة اللي المفروض تتفهرس.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'طلب خدمة إبداعية',
    description: 'إتمام طلب خدمة إبداعية مع المدرب الذي اخترته.',
    path: '/creative-writing/services',
    noIndex: true,
  });
}

import { getSiteSettings } from '@/data/domains/content';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { getStandaloneServices, getProvidersForService } from '@/data/domains/services';
import { getCurrentUser } from '@/data/domains/auth';
import { OrderServiceClient } from './OrderServiceClient';

export const dynamic = 'force-dynamic';

export default async function OrderServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ provider?: string; instructor?: string; child?: string }>;
}) {
  const { serviceId } = await params;
  // `instructor` هو الاسم القديم في الروابط — بيفضل مقبول.
  const {
    provider: providerParam,
    instructor: instructorParam,
    // بييجي من موافقة ولي الأمر على طلب ابنه — المستفيد بيتحدد مسبقًا
    // بدل ما ولي الأمر يدوّر عليه بإيده.
    child: childParam,
  } = await searchParams;

  const settings = await getSiteSettings();
  const services = await getStandaloneServices();
  const service = services.find((s) => s.id === serviceId);
  if (!service) notFound();

  const user = await getCurrentUser();
  if (user.role === 'visitor') {
    redirect('/sign-in');
  }

  // The price shown must be the one the server will actually charge, so it is
  // resolved here from the same source the order action uses.
  let amount = service.price;
  let providerName: string | null = null;
  let providerId: string | null = null;

  // مقدّم الخدمة بيتحدد هنا دايمًا — حتى للخدمة ذات السعر الثابت. السعر
  // المعروض لازم يطلع من نفس المصدر اللي الخادم بيحاسب منه.
  {
    const providers = await getProvidersForService(serviceId);
    const provider = providerParam
      ? providers.find((p) => p.providerId === providerParam)
      : instructorParam
        ? providers.find((p) => p.instructorId === instructorParam)
        : // بلا اختيار: المنصة لو بتقدّم الخدمة، وإلا الوحيد المتاح.
          (providers.find((p) => p.kind === 'platform') ??
            (providers.length === 1 ? providers[0] : undefined));

    if (!provider) {
      redirect(`/creative-writing/services/${serviceId}`);
    }
    amount = provider.price;
    providerName = provider.displayName;
    providerId = provider.providerId;
  }

  return (
    <PageContainer className="py-12 space-y-12 md:py-16">
      <Section containerClassName="mx-auto w-full max-w-2xl pt-16 pb-24">
        <Link
          href={
            service.priceType === 'starts_from'
              ? `/creative-writing/services/${serviceId}`
              : '/creative-writing/services'
          }
          className="mb-8 inline-flex items-center gap-2 font-bold text-slate-500 transition-colors hover:text-emerald-600"
        >
          <ArrowLeft className="h-4 w-4 rotate-180" />
          رجوع
        </Link>

        <h1 className="mb-8 text-3xl font-black tracking-tight text-slate-900">تأكيد الطلب</h1>

        <OrderServiceClient
          paymentWalletNumber={settings.paymentWalletNumber}
          paymentQrUrl={settings.paymentQrUrl}
          serviceId={serviceId}
          serviceName={service.name}
          providerId={providerId}
          providerName={providerName}
          amount={amount}
          presetChildId={childParam}
        />
      </Section>
    </PageContainer>
  );
}
