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

import { notFound, permanentRedirect } from 'next/navigation';
import { getProductBySlug, getAddonProducts, productRedirectPath } from '@/data/domains/products';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { LibraryCustomizationWizard } from '@/components/enha-lak/LibraryCustomizationWizard';
import { requireShopper } from '@/lib/require-shopper';
import { getMyAddonDiscount } from '@/data/domains/subscriptions';
import { getActiveCustomizationFields } from '@/data/domains/customization-fields';

interface PageProps {
  params: Promise<{ productSlug: string }>;
}

export default async function CustomLibraryPage({ params }: PageProps) {
  const { productSlug } = await params;
  // ⚠️ الاتنين على التوازي: التسلسل هنا كان بيزوّد زمن فتح الصفحة
  //    بلا سبب — الإضافات مش متوقّفة على المنتج.
  const [product, addons, extraFields] = await Promise.all([
    getProductBySlug(productSlug),
    getAddonProducts(),
    getActiveCustomizationFields(),
  ]);

  if (!product || product.category !== 'library') {
    notFound();
  }

  // رابط قديم (`prod-<رقم>`) ← الرابط الحالي، تحويل دائم (ملف 136).
  const moved = productRedirectPath(productSlug, product, '/enha-lak/custom-library');
  if (moved) permanentRedirect(moved);

  await requireShopper(`/enha-lak/custom-library/${encodeURIComponent(product.slug)}`);

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section>
        <LibraryCustomizationWizard
          product={product}
          addons={addons}
          addonDiscountPercent={await getMyAddonDiscount()}
          extraFields={extraFields}
        />
      </Section>
    </PageContainer>
  );
}
