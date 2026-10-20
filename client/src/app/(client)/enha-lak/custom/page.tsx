import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'أنت البطل هنا',
    description: 'اطلب قصة مخصصة يكون فيها طفلك هو البطل: اسمه وصورته واهتماماته داخل الحكاية.',
    path: '/enha-lak/custom',
  });
}

import { getAddonProducts } from '@/data/domains/(shared)/products/addons';
import { getPersonalizedProducts } from '@/data/domains/(client)/products/queries';
import { PenTool, Plus } from 'lucide-react';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';

import { PageContainer } from '@/components/PageContainer';
import { ShelfHeader } from '@/components/enha-lak/ShelfHeader';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProductCard } from '@/components/enha-lak/ProductCard';
import { AddonCard } from '@/components/enha-lak/AddonCard';
import { Reveal } from '@/components/ui/Reveal';


export default async function CustomPage() {
  const allProducts = await getPersonalizedProducts();
  const customProducts = allProducts.filter((p) => p.category === 'custom');
  const [addons, content] = await Promise.all([getAddonProducts(), getSiteContent()]);

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* ⚠️ كان `SectionHeader` العام — نفس رأس المدونة والدعم. بقى رأس
          القسم الطفولي، ونفس اللي في المكتبة. */}
      <ShelfHeader
        title={content['custom.title']}
        eyebrow={content['custom.eyebrow']}
        icon={<PenTool className="h-8 w-8" />}
        description={content['custom.description']}
      />

      {/* Custom Products */}
      <Section className="w-full pt-4 md:pt-6" containerClassName="max-w-6xl">
        {/* ⚠️ الكارت بقى مكوّنًا مشتركًا مع المكتبة. كان متكرّرًا
            في الصفحتين بنسختين بدأوا متشابهين وبعدوا، وكل إصلاح
            كان بيتعمل في واحدة وينسى التانية. */}
        {customProducts.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {customProducts.map((product, i) => (
              <Reveal key={product.id} delay={Math.min(i, 5) * 60} className="h-full">
                <ProductCard
                  product={product}
                  actionLabel={content['custom.action']}
                  actionHref={`/enha-lak/custom/${product.slug}`}
                  cardHref={`/enha-lak/product/${product.slug}`}
                  detailsHref={`/enha-lak/product/${product.slug}`}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          /* ⚠️ الشبكة الفاضية كانت بتسيب فراغًا أبيض بلا أي كلمة —
             والزائر بيقرا الفراغ على إن الصفحة باظت. */
          <Card
            accentColor="rose"
            className="flex flex-col items-center justify-center rounded-[1.75rem] py-20 text-center"
          >
            <h2 className="mb-2 text-2xl font-black text-slate-800">
              {content['custom.empty.title']}
            </h2>
            <p className="font-medium text-slate-600">
              {content['custom.empty.text']}
            </p>
          </Card>
        )}
      </Section>

      {/* Addons */}
      <Section containerClassName="max-w-6xl rounded-3xl border border-slate-100 bg-slate-50/50 p-6 md:p-12 pb-24">
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
            {content['custom.addons.title']}
          </h2>
          <p className="mt-4 font-medium text-slate-500">
            {content['custom.addons.text']}
          </p>
          <p className="mt-2 text-sm font-bold text-slate-600">
            {content['custom.addons.note']}
          </p>
        </div>

        {/* ⚠️ كانت كروت نص من غير صورة ولا صفحة تفاصيل. بقت بنفس شكل كروت
            القصص فوق (ملاحظة تامر، 10 أكتوبر) — والكارت بيودّي لصفحة الإضافة. */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {addons.map((addon, i) => (
            <Reveal key={addon.id} delay={Math.min(i, 5) * 60} className="h-full">
              <AddonCard addon={addon} badge={content['custom.addons.badge']} />
            </Reveal>
          ))}
        </div>
      </Section>


    </PageContainer>
  );
}
