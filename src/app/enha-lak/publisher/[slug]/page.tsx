import { formatPrice } from '@/lib/utils';
import { getPersonalizedProducts, getPublisherBySlug } from '@/data/domains/products';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { pageMetadata } from '@/lib/seo';


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
        <h2 className="text-2xl font-black text-slate-900 mb-8 border-b-2 border-slate-100 pb-4 inline-block">إصدارات الناشر</h2>
        {publisherProducts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {publisherProducts.map((product) => (
              <Card
                key={product.id}
                accentColor="rose"
                interactive
                // ⚠️ كان `hover:-translate-y-1` **بلا أي `transition`**
                //    — يعني الكارت بينطّ نطّة فورية بدل ما يرتفع،
                //    وبيتجاهل «تقليل الحركة» تمامًا. `interactive`
                //    فيها الاتنين.
                className="group overflow-hidden relative p-0"
              >
                {/* نفس علاج الكارت وصفحة التفاصيل: الغلاف مايتقصّش. */}
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-b from-rose-50 via-white to-slate-50">
                  {product.coverImageUrl ? (
                    <Image
                      src={optimizedImageUrl(product.coverImageUrl, 600)}
                      alt={product.name}
                      fill sizes="(max-width: 768px) 100vw, 300px"
                      className="object-contain p-6 drop-shadow-lg transition-transform duration-[var(--dur-slow)] ease-[var(--ease-ui)] motion-safe:group-hover:scale-[1.04]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ImagePlaceholder label={product.name} />
                  )}
                </div>
                <div className="p-5">
                  {/* ⚠️ `line-clamp-1` بتقصّ اسم الكتاب من أول سطر —
                      وأسماء الكتب العربية نادرًا بتخلص في سطر. بقت ٢. */}
                  <h3 className="line-clamp-2 text-lg leading-snug font-bold text-slate-900">
                    {product.name}
                  </h3>
                  <div className="mt-4 flex items-center justify-between">
                    {/* ⚠️ `rose-500` كنصّ على أبيض = 3.76:1 وبيسقط في
                        المعيار (المطلوب 4.5:1). الرمز `-strong` = 700. */}
                    <span className="text-enha-lak-strong text-lg font-black">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">لا توجد إصدارات حالية لهذا الناشر.</p>
        )}
      </Section>
    </PageContainer>
  );
}
