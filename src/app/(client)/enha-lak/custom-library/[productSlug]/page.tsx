import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// صفحة داخل مسار الشراء: مالهاش لازمة في نتايج البحث، والرابط القانوني
// بيوجّه للصفحة العامة اللي المفروض تتفهرس.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'تخصيص إصدار من المكتبة',
    description: 'أضف لمسة شخصية على إصدار من المكتبة قبل إتمام الطلب.',
    path: '/enha-lak/library',
    noIndex: true,
  });
}

import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/data/domains/products';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { LibraryCustomizationWizard } from '@/components/enha-lak/LibraryCustomizationWizard';

interface PageProps {
  params: Promise<{ productSlug: string }>;
}

export default async function CustomLibraryPage({ params }: PageProps) {
  const { productSlug } = await params;
  const product = await getProductBySlug(productSlug);

  if (!product || product.category !== 'library') {
    notFound();
  }

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section>
        <LibraryCustomizationWizard product={product} />
      </Section>
    </PageContainer>
  );
}
