import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// صفحة داخل مسار الشراء: مالهاش لازمة في نتايج البحث، والرابط القانوني
// بيوجّه للصفحة العامة اللي المفروض تتفهرس.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'تخصيص القصة',
    description: 'أدخل بيانات طفلك لتخصيص القصة قبل إتمام الطلب.',
    path: '/enha-lak/custom',
    noIndex: true,
  });
}

import { getProductBySlug, getAddonProducts, productRedirectPath } from '@/data/domains/products';
import { permanentRedirect } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import Link from 'next/link';
import { PersonalizationWizard } from '@/components/enha-lak/PersonalizationWizard';
import { requireShopper } from '@/lib/require-shopper';

export default async function CustomProductPage({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  const [product, addons] = await Promise.all([
    getProductBySlug(productSlug),
    getAddonProducts(),
  ]);

  // رابط قديم (`prod-<رقم>`) ← الرابط الحالي، تحويل دائم (ملف 136).
  if (product) {
    const moved = productRedirectPath(productSlug, product, '/enha-lak/custom');
    if (moved) permanentRedirect(moved);
  }

  // ⚠️ **الحارس كان `ownerType !== 'platform'`.**
  //
  //    يعني المعالج ده كان بيفتح لأي منتج للمنصة **مهما كان تصنيفه** —
  //    بما فيهم منتجات «المكتبة» اللي المفروض تخصيص غلاف بس. وفي نفس
  //    الوقت كان بيرفض أي منتج «مخصص» لناشر.
  //
  //    التصنيف هو اللي بيقول إيه الشغل اللي العميل هياخده، فهو اللي
  //    بيحرس. والمالك بيقرّر مين بياخد فلوس وبس.
  if (!product || product.category !== 'custom') {
    return (
      <PageContainer className="py-12 space-y-12 md:py-16">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h1 className="text-3xl font-black text-slate-800">المنتج غير متاح للتخصيص</h1>
          <Link href="/enha-lak" className="mt-8 rounded-xl bg-rose-700 px-6 py-3 font-bold text-white hover:bg-rose-800 transition-colors">
            العودة للمتجر
          </Link>
        </div>
      </PageContainer>
    );
  }

  await requireShopper(`/enha-lak/custom/${encodeURIComponent(product.slug)}`);

  return (
    <div className="min-h-screen bg-slate-50">
      <PersonalizationWizard product={product} addons={addons} />
    </div>
  );
}
