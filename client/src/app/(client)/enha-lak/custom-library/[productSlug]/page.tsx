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
import { getProductBySlug } from '@/data/domains/(client)/products/queries';
import { getAddonProducts } from '@/data/domains/(shared)/products/addons';
import { productRedirectPath } from '@/data/domains/(shared)/products/queries';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { LibraryCustomizationWizard } from '@/components/enha-lak/LibraryCustomizationWizard';
import { getDeliveryCatalog } from '@/data/domains/(client)/shipping/queries';
import { requireShopper } from '@/lib/require-shopper';
import { getMyAddonDiscount } from '@/data/domains/(client)/subscriptions/box';
import { getActiveCustomizationFields } from '@/data/domains/(client)/products/customization-fields';

interface PageProps {
  params: Promise<{ productSlug: string }>;
}

export default async function CustomLibraryPage({ params }: PageProps) {
  const { productSlug } = await params;
  // ⚠️ الاتنين على التوازي: التسلسل هنا كان بيزوّد زمن فتح الصفحة
  //    بلا سبب — الإضافات مش متوقّفة على المنتج.
  const [product, addons] = await Promise.all([getProductBySlug(productSlug), getAddonProducts()]);

  if (!product || product.category !== 'library') {
    notFound();
  }

  // رابط قديم (`prod-<رقم>`) ← الرابط الحالي، تحويل دائم (ملف 136).
  const moved = productRedirectPath(productSlug, product, '/enha-lak/custom-library');
  if (moved) permanentRedirect(moved);

  await requireShopper(`/enha-lak/custom-library/${encodeURIComponent(product.slug)}`);

  // الخانات بتتفلتر بالمنتج (ملف 12) — فلازم رقمه الأول.
  // ⚠️ مفيش أهداف هنا: تخصيص الغلاف مالوش خطوة «هدف القصة» أصلًا.
  const [extraFields, addonDiscountPercent, delivery] = await Promise.all([
    getActiveCustomizationFields({ productId: product.id }),
    getMyAddonDiscount(),
    // «هنوصّل فين؟» في خطوة الإضافات — كتاب المكتبة مطبوع ودايمًا بيتشحن.
    getDeliveryCatalog(),
  ]);

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section>
        <LibraryCustomizationWizard
          product={product}
          addons={addons}
          addonDiscountPercent={addonDiscountPercent}
          extraFields={extraFields}
          delivery={delivery}
        />
      </Section>
    </PageContainer>
  );
}
