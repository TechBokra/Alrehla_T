import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'القصص المخصصة',
    description: 'اطلب قصة مخصصة يكون فيها طفلك هو البطل: اسمه وصورته واهتماماته داخل الحكاية.',
    path: '/enha-lak/custom',
  });
}

import { formatPrice } from '@/lib/utils';
import { getAddonProducts, getPersonalizedProducts } from '@/data/domains/products';
import { PenTool, Plus } from 'lucide-react';

import { PageContainer } from '@/components/PageContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProductCard } from '@/components/enha-lak/ProductCard';


export default async function CustomPage() {
  const allProducts = await getPersonalizedProducts();
  const customProducts = allProducts.filter((p) => p.category === 'custom');
  const addons = await getAddonProducts();

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Header */}
      <div className="relative">
        <SectionHeader
          title="أنت البطل هنا"
          icon={<PenTool className="h-8 w-8" />}
          iconClassName="bg-rose-50 text-rose-600"
          description="نصنع محتوى مخصصاً لطفلك من الصفر بعد إتمام الطلب، ليكون هو محور القصة بأدق تفاصيلها."
        />

      </div>

      {/* Custom Products */}
      <Section containerClassName="max-w-6xl">
        {/* ⚠️ الكارت بقى مكوّنًا مشتركًا مع المكتبة. كان متكرّرًا
            في الصفحتين بنسختين بدأوا متشابهين وبعدوا، وكل إصلاح
            كان بيتعمل في واحدة وينسى التانية. */}
        {customProducts.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-3">
            {customProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                actionLabel="ابدأ التخصيص"
                actionHref={`/enha-lak/custom/${product.slug}`}
                detailsHref={`/enha-lak/product/${product.slug}`}
              />
            ))}
          </div>
        ) : (
          /* ⚠️ الشبكة الفاضية كانت بتسيب فراغًا أبيض بلا أي كلمة —
             والزائر بيقرا الفراغ على إن الصفحة باظت. */
          <Card
            accentColor="rose"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <h3 className="mb-2 text-2xl font-black text-slate-800">
              القصص المخصصة لسه بتتجهّز
            </h3>
            <p className="font-medium text-slate-600">
              بنجهّز باقات التخصيص دلوقتي — ارجع لنا قريب.
            </p>
          </Card>
        )}
      </Section>

      {/* Addons */}
      <Section containerClassName="max-w-4xl rounded-3xl border border-slate-100 bg-slate-50/50 p-8 md:p-12 pb-24">
        {/* ⚠️ **كان هنا زرار «أضف للسلة» على كل إضافة.**

            والإضافة **مش منتج يتباع لوحده**: هي بتتعلّق بقصة، وسعرها
            بيتحسب جوّه سعر القصة في القاعدة. والأهم إن أرقام الإضافات
            في جدول `addon_products` — ودالة إنشاء الطلب بتدوّر على كل
            بند في `personalized_products`. يعني إضافة لوحدها في السلة
            بتخلّي **الطلب كله يترفض**، بالقصص اللي معاها.

            والعميل مكانش هيفهم السبب: الرسالة «منتج غير موجود: <رقم>».

            فالقسم ده بقى **عرضًا لا سلّة**: بيقول إيه المتاح وبكام،
            والإضافة بتتاخد وإنت بتخصّص القصة — وهي الخطوة الوحيدة
            اللي بتعرف الإضافة تتعلّق بإيه. */}
        <div className="mb-10 text-center">
          <h2 className="flex items-center justify-center gap-3 text-3xl font-black text-slate-800">
            <Plus className="h-8 w-8 text-rose-500" />
            إضافات اختيارية
          </h2>
          <p className="mt-4 font-medium text-slate-500">
            اجعل تجربة طفلك أكثر متعة وتفاعلاً مع هذه الإضافات الممتعة.
          </p>
          <p className="mt-2 text-sm font-bold text-slate-600">
            الإضافات بتتختار وإنت بتخصّص القصة — مش بتتطلب لوحدها.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {addons.map((addon) => (
            <Card
              key={addon.id}
              accentColor="rose"
              className="flex flex-col justify-between p-6 shadow-sm"
            >
              <div>
                <h3 className="mb-2 text-xl font-bold text-slate-800">
                  {addon.name}
                </h3>
                <p className="mb-4 text-sm leading-relaxed font-medium text-slate-500">
                  {addon.description}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-lg font-black text-rose-700">
                  {formatPrice(addon.price)}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  تُضاف أثناء التخصيص
                </span>
              </div>
            </Card>
          ))}
        </div>
      </Section>


    </PageContainer>
  );
}
