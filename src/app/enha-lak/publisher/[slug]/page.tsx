import { getPersonalizedProducts, getPublisherBySlug } from '@/data/domains/products';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { ProductCard } from '@/components/enha-lak/ProductCard';
import { customizationPath } from '@/lib/product-categories';


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publisher = await getPublisherBySlug(slug);
  if (!publisher) return { title: 'ناشر غير موجود' };
  return pageMetadata({
    title: `${publisher.name} — دار نشر`,
    description: publisher.bio || `تصفّح إصدارات ${publisher.name} على منصة الرحلة.`,
    path: `/enha-lak/publisher/${publisher.slug}`,
    image: publisher.logoUrl,
  });
}

export default async function PublisherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publisher = await getPublisherBySlug(slug);

  if (!publisher) {
    notFound();
  }

  const allProducts = await getPersonalizedProducts();
  const publisherProducts = allProducts.filter(p => p.publisherId === publisher.id);

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="pt-12 pb-8">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-right">
          {publisher.logoUrl && (
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-lg">
              <Image
                src={publisher.logoUrl}
                alt={publisher.name}
                fill sizes="(max-width: 768px) 100vw, 300px" priority
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black text-slate-900">{publisher.name}</h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl">{publisher.bio}</p>
          </div>
        </div>
      </Section>

      <Section containerClassName="pb-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-slate-100 pb-4">
          <h2 className="text-2xl font-black text-slate-900">إصدارات الناشر</h2>
          {/* الرابط بيفتح المكتبة على الدار دي بالظبط — ومن هناك الأب
              يضيّق بالسنّ. نفس الرابط اللي بيتبعت على واتساب. */}
          {publisherProducts.some((p) => p.category === 'library') && (
            <Link
              href={`/enha-lak/library?publisher=${encodeURIComponent(publisher.slug)}`}
              className="text-enha-lak-strong inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold"
            >
              كتب الدار في المكتبة، حسب السنّ
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
        {publisherProducts.length > 0 ? (
          // ⚠️ **كان كارتًا تالتًا مكتوبًا يدويًّا هنا** — نسخة من كارت
          //    المكتبة قبل ما تتصلّح: من غير سنّ ولا «غلاف مخصص فقط» ولا
          //    زرار تخصيص. نفس درس ٢٠: الإصلاح في المكوّن المشترك ما
          //    وصلش للمكان اللي بيعيد كتابة نفس الشكل. بقى `ProductCard`.
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {publisherProducts.map((product) => {
              const custom = customizationPath(product.category, product.slug);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  cardHref={`/enha-lak/product/${product.slug}`}
                  actionLabel={custom?.label ?? 'عرض التفاصيل'}
                  actionHref={custom?.href ?? `/enha-lak/product/${product.slug}`}
                  detailsHref={custom ? `/enha-lak/product/${product.slug}` : undefined}
                  detailsLabel="عرض تفاصيل القصة"
                />
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500">لا توجد إصدارات حالية لهذا الناشر.</p>
        )}
      </Section>
    </PageContainer>
  );
}
