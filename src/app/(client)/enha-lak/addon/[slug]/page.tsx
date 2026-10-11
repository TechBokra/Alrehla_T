import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { addonCustomerPrice } from '@/lib/item-format';
import { pageMetadata } from '@/lib/seo';
import { breadcrumbSchema } from '@/lib/structured-data';
import { getAddonBySlug } from '@/data/domains/products';
import { getSiteContent } from '@/data/domains/content';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RichText } from '@/components/ui/RichText';
import { ProductGallery } from '@/components/enha-lak/ProductGallery';
import { JsonLd } from '@/components/seo/JsonLd';
import { ShareButton } from '@/components/share/ShareButton';

/**
 * صفحة تفاصيل الإضافة — **بنفس تصميم صفحة المنتج** (ملاحظة تامر، 10 أكتوبر):
 * معرض صور، اسم، وصف كامل، نقاط التفاصيل، سعر، مشاركة.
 *
 * ⚠️ **الفرق الوحيد: مفيش «أضف للسلة».** الإضافة مابتتطلبش لوحدها — دالة
 *    الطلب بترفض الطلب كله لو إضافة لوحدها في السلة. فمكان الزرار سطر
 *    بيقول «بتتطلب مع القصة» وزرار يودّي لاختيار قصة.
 *
 * ⚡ بتتبني أول ما حد يفتحها وبتتخزّن، والتعديل من اللوحة بيجدّدها
 *    (`refreshPublicPages` في `actions/addons`).
 */
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const addon = await getAddonBySlug(slug);
  if (!addon) return { title: 'الإضافة غير موجودة' };
  return pageMetadata({
    title: addon.name,
    description: addon.description || addon.name,
    path: `/enha-lak/addon/${addon.slug}`,
    image: addon.imageUrl,
  });
}

export default async function AddonDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [addon, content] = await Promise.all([getAddonBySlug(slug), getSiteContent()]);

  if (!addon) {
    return (
      <PageContainer className="!py-0 !space-y-0">
        <Section containerClassName="flex flex-col items-center justify-center py-20 text-center">
          <h1 className="text-3xl font-black text-slate-800">الإضافة غير موجودة</h1>
          <p className="mt-4 text-slate-500">الإضافة دي مش متاحة دلوقتي.</p>
          <Button href="/enha-lak/custom" accentColor="rose" className="mt-8 px-6 py-3">
            العودة للقصص المخصصة
          </Button>
        </Section>
      </PageContainer>
    );
  }

  const path = `/enha-lak/addon/${addon.slug}`;
  const images = [
    ...new Set([addon.imageUrl, ...(addon.galleryImageUrls ?? [])].filter((u): u is string => Boolean(u))),
  ];

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* مسار التنقّل بس — من غير بيانات «منتج» بسعر: الإضافة مش بتتشتري
          لوحدها، ونتيجة بحث فيها سعر وزرار شراء هتبقى وعد مالوش تنفيذ. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: 'الرئيسية', path: '/' },
          { name: 'إنها لك', path: '/enha-lak' },
          { name: 'أنت البطل هنا', path: '/enha-lak/custom' },
          { name: addon.name, path },
        ])}
      />

      <Section>
        <div className="mb-8">
          <Link
            href="/enha-lak/custom"
            className="inline-flex items-center gap-2 font-bold text-slate-500 transition-colors hover:text-rose-600"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للقصص المخصصة
          </Link>
        </div>

        {/* نفس ترتيب صفحة المنتج: على الموبايل الاسم ← الصورة ← السعر،
            وعلى اللابتوب الصورة في عمود والباقي في عمود. */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="lg:col-start-2 lg:row-start-1 lg:self-end">
            <h1 className="text-3xl leading-tight font-black text-slate-900 md:text-4xl">{addon.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                باسم الطفل وصورته
              </span>
            </div>
            {addon.description && (
              <p className="mt-4 leading-relaxed text-slate-600 md:mt-6 md:text-lg">{addon.description}</p>
            )}
          </div>

          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <ProductGallery images={images} alt={addon.name} downloadName={`alrehla-${addon.slug}`} />
          </div>

          <div className="flex flex-col justify-start space-y-6 lg:col-start-2 lg:row-start-2 lg:space-y-8 lg:self-start">
            {addon.longDescription && (
              <RichText value={addon.longDescription} className="space-y-4 leading-relaxed text-slate-600" />
            )}

            {addon.features && addon.features.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-slate-800">التفاصيل</h2>
                <ul className="space-y-2">
                  {addon.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-600">
                      <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Card accentColor="rose" className="p-6">
              <span className="text-enha-lak-strong text-3xl font-black">
                {formatPrice(addonCustomerPrice(addon))}
              </span>
              <p className="mt-1 text-sm font-bold text-slate-500">{content['custom.addons.badge']}</p>

              {/* ⚠️ مكان «أضف للسلة»: الإضافة بتتختار جوّه تخصيص القصة. */}
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-100">
                {content['custom.addons.note']}
              </p>

              <div className="mt-6">
                <Button
                  href="/enha-lak/custom"
                  accentColor="rose"
                  className="w-full justify-center !bg-slate-900 !text-white hover:!bg-slate-800"
                >
                  اختار قصة وابدأ التخصيص
                </Button>
                <ShareButton
                  variant="subtle"
                  theme="rose"
                  label="ابعته لحد يحبه"
                  className="mt-3 w-full"
                  data={{ title: addon.name, description: addon.description, url: path }}
                />
              </div>
            </Card>
          </div>
        </div>
      </Section>
    </PageContainer>
  );
}
