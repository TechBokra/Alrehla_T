import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import Link from 'next/link';
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
import { isVisibleFor } from '@/lib/applies-to';
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

  // ⚠️ كتاب المكتبة بيتطبع وبيتشحن بس. والتوصيل متوقف = نقول ده هنا
  //    **قبل** خطوات التخصيص، مش في آخرها (قرار ٢٤ أكتوبر). الكارت
  //    وصفحة المنتج بيقولوه قبلها كمان؛ ده للرابط المباشر.
  if (delivery.pause.paused) {
    return (
      <PageContainer className="!py-0 !space-y-0">
        <Section containerClassName="mx-auto w-full max-w-2xl py-16">
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-8 text-center">
            <h1 className="text-2xl font-black text-amber-900">غير متاح مؤقتًا</h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-amber-900">
              {delivery.pause.message.trim() || 'التوصيل متوقف مؤقتًا'} — والكتاب ده بيتطبع وبيتشحن، فبيرجع أول ما
              التوصيل يفتح.
            </p>
            <Link
              href="/enha-lak"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3 font-bold text-white transition-colors hover:bg-amber-800"
            >
              تصفّح باقي المنتجات
            </Link>
          </div>
        </Section>
      </PageContainer>
    );
  }

  // مدة حفظ صورة الطفل — لجملة الخصوصية جنب الرفع (دراسة المنافسين).
  const photoSettings = await getSiteSettings();

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section>
        <LibraryCustomizationWizard
          product={product}
          addons={addons.filter((a) => isVisibleFor(a.appliesTo, { productId: product.id }))}
          addonDiscountPercent={addonDiscountPercent}
          extraFields={extraFields}
          delivery={delivery}
          photoRetentionDays={photoSettings.childPhotoRetentionDays}
        />
      </Section>
    </PageContainer>
  );
}
