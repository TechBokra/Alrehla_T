import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// صفحة داخل مسار الشراء: مالهاش لازمة في نتايج البحث، والرابط القانوني
// بيوجّه للصفحة العامة اللي المفروض تتفهرس.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'تخصيص اشتراك صندوق الرحلة',
    description: 'أدخل بيانات طفلك لتخصيص محتوى الصندوق قبل الاشتراك.',
    path: '/enha-lak/subscription',
    noIndex: true,
  });
}

import { notFound } from 'next/navigation';
import { getSubscriptionTiers, getAddonProducts } from '@/data/domains/products';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { PersonalizationWizard } from '@/components/enha-lak/PersonalizationWizard';
import { PersonalizedProduct } from '@/types';

interface PageProps {
  params: Promise<{ tierId: string }>;
}

export default async function CustomSubscriptionPage({ params }: PageProps) {
  const { tierId } = await params;
  const [tiers, addons] = await Promise.all([
    getSubscriptionTiers(),
    getAddonProducts(),
  ]);
  const tier = tiers.find(t => t.id === tierId);

  if (!tier) {
    notFound();
  }

  const product: PersonalizedProduct = {
    id: tier.id,
    slug: tier.id,
    name: `صندوق الرحلة - ${tier.name}`,
    category: 'subscription',
    price: tier.priceTotal,
    shortDescription: `اشتراك صندوق الرحلة (لمدة ${tier.durationMonths} ${tier.durationMonths === 1 ? 'شهر' : 'أشهر'})`,
    ownerType: 'platform',
    // المنتج ده مركَّب من خطة الصندوق لا مقروء من جدول المنتجات،
    // فمفيش عمود إيقاف يتقرا — ووجوده هنا معناه إنه متاح.
    isActive: true,
    coverImageUrl: undefined,
    features: [
      'قصة مخصصة جديدة شهرياً',
      'أنشطة تفاعلية ومفاجآت',
      'تخصيص كامل للشخصية والهدف التربوي'
    ]
  };

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section>
        <div className="mb-4 text-center">
          <h1 className="text-3xl font-black text-rose-700">تخصيص صندوق الرحلة</h1>
          <p className="mt-2 text-slate-600">قم بإعداد تفاصيل البطل للاشتراك ({tier.name})</p>
        </div>
        <PersonalizationWizard product={product} addons={addons} />
      </Section>
    </PageContainer>
  );
}
