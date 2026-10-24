import { PriceTag } from '@/components/ui/PriceTag';
import { getProductBySlug } from '@/data/domains/(client)/products/queries';
import { getPublishers } from '@/data/domains/(shared)/publishers/queries';
import { productRedirectPath } from '@/data/domains/(shared)/products/queries';
import { permanentRedirect } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import Link from 'next/link';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { RichText } from '@/components/ui/RichText';
import { ProductGallery } from '@/components/enha-lak/ProductGallery';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { productSchema, breadcrumbSchema } from '@/lib/structured-data';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { ShareSection } from '@/components/share/ShareSection';
import { ArrowLeft, Building2, Palette } from 'lucide-react';
import { AgeBadge } from '@/components/enha-lak/AgeBadge';
import { customizationPath } from '@/lib/product-categories';
import { priceBlocks } from '@/lib/item-format';
import { productUnavailableReason } from '@/lib/product-availability';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
import { getPaymentAvailability } from '@/data/domains/(shared)/payments/queries';
import { METHOD_LABELS } from '@/lib/payments/settings';
import { getDeliveryPause } from '@/data/domains/(client)/shipping/queries';

/**
 * ⚡ الصفحة بتتبني أول ما حد يفتحها، وبعدين **بتتخزّن** وتتبعت جاهزة من
 *    Vercel (~٠٫١ ثانية بدل ~٠٫٨). من غير الدالة دي كانت بتتبني من الأول مع
 *    كل زيارة — وده أكتر رابط بيتبعت على واتساب. التعديل من اللوحة بيجدّدها.
 */
export async function generateStaticParams() {
  return [];
}


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'منتج غير موجود' };
  return pageMetadata({
    title: product.name,
    description: product.shortDescription || product.name,
    path: `/enha-lak/product/${product.slug}`,
    image: product.coverImageUrl,
  });
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return (
      <PageContainer className="!py-0 !space-y-0">
        <Section containerClassName="flex flex-col items-center justify-center py-20 text-center">
          <h1 className="text-3xl font-black text-slate-800">المنتج غير موجود</h1>
          <p className="mt-4 text-slate-500">عذراً، المنتج الذي تبحث عنه غير متاح أو لا يمتلك صفحة تفصيلية مستقلة.</p>
          <Button href="/enha-lak" accentColor="rose" className="mt-8 px-6 py-3">
            العودة للمتجر
          </Button>
        </Section>
      </PageContainer>
    );
  }

  // رابط قديم (`prod-<رقم>`) ← الرابط الحالي، تحويل دائم (ملف 136):
  // الرابط اللي اتبعت على واتساب بيشتغل، ومحرك البحث بينقل ترتيبه.
  const moved = productRedirectPath(slug, product, '/enha-lak/product');
  if (moved) permanentRedirect(moved);

  // المسار من التصنيف — حقل واحد بيقرّر، مش اتنين بيتنافسوا.
  const customization = customizationPath(product.category, product.slug);
  // بالتوصيل بس والتوصيل متوقف؟ (قرار ٢٤ أكتوبر)
  const [content, payment] = await Promise.all([getSiteContent(), getPaymentAvailability()]);
  const unavailable = productUnavailableReason(product, await getDeliveryPause());

  // ترتيب الأسعار (الإلكترونية أولًا) من مصدر واحد مشترك مع الكارت.
  const prices = priceBlocks(product);

  // الناشر باسمه ورابط صفحته — «الكتاب ده من دار أعرفها» معلومة بتبيع.
  // ⚠️ من القايمة العامة وبالحالة: ناشر موقوف مايتعرضش رابطه.
  const publisher = product.publisherId
    ? (await getPublishers()).find((p) => p.id === product.publisherId && p.status === 'active')
    : undefined;

  const settings = await getSiteSettings();
  const siteName = settings.siteName?.trim() || 'الرحلة';

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* بيانات منظّمة: اسم المنتج وسعره، وده اللي بيخلي السعر يظهر في نتيجة البحث. */}
      <JsonLd
        data={[
          productSchema({
            name: product.name,
            description: product.shortDescription,
            image: product.coverImageUrl ? optimizedImageUrl(product.coverImageUrl, 1200) : undefined,
            path: `/enha-lak/product/${product.slug}`,
            price: product.price,
            brand: siteName,
          }),
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'إنها لك', path: '/enha-lak' },
            { name: product.name, path: `/enha-lak/product/${product.slug}` },
          ]),
        ]}
      />


      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.shortDescription,
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": "EGP"
    }
  }) }} />
      <Section>
        {/* Top Navigation */}
        <div className="mb-8">
          <Link
            href={product.category === 'library' ? '/enha-lak/library' : '/enha-lak/custom'}
            className="inline-flex items-center gap-2 font-bold text-slate-500 hover:text-rose-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {product.category === 'library' ? 'العودة للمكتبة' : 'العودة للقصص المخصصة'}
          </Link>
        </div>

        {/* ⚠️ **الترتيب على الموبايل كان غلط.**

            `grid lg:grid-cols-2` معناه إن العمودين بيتراصّوا تحت بعض
            على التليفون **بترتيب الكود**: الصورة الأول، وبعدها الاسم.
            والصورة `3/4` يعني حوالي 470 بكسل على شاشة 375 — فالزائر
            بيفتح صفحة منتج فيشوف **صندوق صورة وبس**، ولازم ينزل
            نص شاشة عشان يعرف اسم المنتج وسعره. ولو الصورة لسه
            مترفعتش (زي دلوقتي) بيشوف مربّعًا رماديًّا فاضيًا.

            دلوقتي الترتيب على التليفون: **الاسم ← الصورة ← السعر
            والزرار**، وعلى اللابتوب زي ما كان بالظبط — الصورة يمين
            في عمود، والباقي شمال — عن طريق تحديد الصف والعمود
            صراحةً بدل الاعتماد على ترتيب الكود. */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="lg:col-start-2 lg:row-start-1 lg:self-end">
            <h1 className="text-3xl leading-tight font-black text-slate-900 md:text-4xl">{product.name}</h1>

            {/* ══ أول تلات أسئلة عند الأب — قبل الوصف ══════════════
                ينفع لسنّ ابني؟ · من أنهي دار؟ · إيه اللي بيتخصّص؟
                كانوا مش موجودين في الصفحة خالص (السنّ مكانش ليه عمود). */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <AgeBadge minAge={product.minAge} maxAge={product.maxAge} size="md" />
              {publisher && (
                <Link
                  href={`/enha-lak/publisher/${publisher.slug}`}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 transition-colors hover:border-rose-300"
                >
                  <Building2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {publisher.name}
                </Link>
              )}
              {product.category === 'library' && (
                <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-rose-50 px-3.5 text-sm font-bold text-rose-800 ring-1 ring-rose-100">
                  <Palette className="h-4 w-4" aria-hidden="true" />
                  غلاف مخصص فقط — القصة زي ما هي
                </span>
              )}
            </div>

            <p className="mt-4 leading-relaxed text-slate-600 md:mt-6 md:text-lg">{product.shortDescription}</p>
          </div>

          {/* ══ المعرض ═══════════════════════════════════════
              كان صورة واحدة ثابتة. بقى الغلاف ومعاه الصور الإضافية
              (`gallery_image_urls` — ملف 130).

              ⚠️ **`object-contain` زيّ ما هو**: دي أغلفة كتب
                 وصفحات، والقصّ بيشيل العنوان أو نصّ الصفحة. (كان
                 `cover` وقِست إنه بيقصّ ربع الغلاف.) */}
          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <ProductGallery
              // ⚠️ الغلاف أولًا دايمًا، والمكرّر بيتشال: الغلاف
              //    ممكن يكون مكتوبًا في المعرض كمان، وصورتان
              //    متطابقتان في الشريط بيبانوا غلطة عرض.
              images={[
                ...new Set(
                  [product.coverImageUrl, ...(product.galleryImageUrls ?? [])].filter(
                    (u): u is string => Boolean(u),
                  ),
                ),
              ]}
              alt={product.name}
              downloadName={`alrehla-${product.slug}`}
            />
          </div>
          
          <div className="flex flex-col justify-start space-y-6 lg:col-start-2 lg:row-start-2 lg:space-y-8 lg:self-start">
            {/* ══ الوصف الكامل ═══════════════════════════════
                `shortDescription` سطر للكارت، وده الوصف اللي العميل
                بيقرا عشان يقرّر (`long_description` — ملف 130).

                ⚠️ و`RichText` مش نصًّا خامًا: بيحوّل `## عنوان` و
                   `- نقطة` و`**عريض**` لعناصر حقيقية، **ومابيقبلش
                   HTML خام عن قصد** — أي حد عنده صلاحية تعديل
                   المحتوى كان هيقدر يحقن سكربت في صفحة عامة.
                   (ونفس المكوّن اللي المدونة والشروط بيستعملوه.) */}
            {product.longDescription && (
              <RichText
                value={product.longDescription}
                className="space-y-4 leading-relaxed text-slate-600"
              />
            )}

            {product.features && product.features.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-slate-800">تفاصيل الكتاب</h2>
                <ul className="space-y-2">
                  {product.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-600">
                      <svg className="h-5 w-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <Card accentColor="rose" className="p-6">
              {/* ══ السعر ═══════════════════════════════════════
                  الإلكترونية أولًا لما تكون متاحة (قرار تامر، ١٥
                  أكتوبر) — هي الأرخص ومن غير شحن ومن غير انتظار،
                  وكانت سطرًا صغيرًا تحت المطبوع. والترتيب من
                  `priceBlocks` عشان الكارت والصفحة يقولوا نفس
                  الحاجة. */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-bold text-slate-500">{prices.headline.label}</span>
                <PriceTag
                  price={prices.headline.price}
                  listPrice={prices.headline.listPrice}
                  endsAt={prices.headline.endsAt}
                  label={prices.headline.saleLabel}
                  className="text-enha-lak-strong text-3xl font-black"
                />
              </div>
              {prices.headline.format === 'electronic' && (
                <p className="mt-1 text-sm font-medium text-emerald-700">
                  {/* ⚠️ كانت «فورًا» — والقصة بيكتبها الفريق في أيام (خطوات «كيف تطلب»). */}
                  بتوصلك على الإيميل — من غير شحن.
                </p>
              )}
              {/* ملف 138: العميل يعرف قبل المعالج إن فيه الاختيار التاني وبكام. */}
              {prices.secondary && (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm font-bold text-slate-700">
                  <span>أو {prices.secondary.label} بـ</span>
                  <PriceTag
                    price={prices.secondary.price}
                    listPrice={prices.secondary.listPrice}
                    endsAt={prices.secondary.endsAt}
                    showBadge={false}
                    showEnds={false}
                    className="font-bold"
                  />
                  <span>— بتتشحن لحد باب البيت</span>
                </p>
              )}
              
              {/* ══ السعر بيشمل إيه، وإزاي يتدفع، وإمتى يوصل ══════════
                  دراسة المنافسين (١٧ أكتوبر): «وضّحوا ما يشتريه السعر وكيف
                  يُدفع» — قبل التخصيص، مش في آخره. كل سطر هنا متنفّذ فعلًا:
                  المعاينة (story_preview)، والدفع من إعدادات الدفع،
                  والمدة من نص «كيف تطلب» اللي الإدارة بتكتبه. */}
              <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm font-medium text-slate-700">
                <li className="flex gap-2">
                  <span className="text-emerald-600" aria-hidden="true">✓</span>
                  {product.category === 'library'
                    ? 'الغلاف باسم طفلك وصورته — والقصة نفسها زي ما هي.'
                    : 'قصة بتتكتب لطفلك باسمه وصورته والقيمة اللي تختارها.'}
                </li>
                {product.category !== 'library' && (
                  <li className="flex gap-2">
                    <span className="text-emerald-600" aria-hidden="true">✓</span>
                    بتراجع القصة وتوافق عليها قبل ما تتنفّذ.
                  </li>
                )}
                {content['enhaLak.step4.text']?.trim() && (
                  <li className="flex gap-2">
                    <span className="text-emerald-600" aria-hidden="true">✓</span>
                    {content['enhaLak.step4.text']}
                  </li>
                )}
                <li className="flex gap-2">
                  <span className="text-emerald-600" aria-hidden="true">✓</span>
                  {payment.mode === 'gateway'
                    ? `الدفع أونلاين: ${payment.methods.map((m) => METHOD_LABELS[m]).join(' · ')}.`
                    : 'الدفع بالتحويل (إنستاباي أو محفظة)، وبترفع الإيصال بعدها.'}
                </li>
              </ul>

              <div className="mt-6">
                {/* ⚠️ **الشرط كان `ownerType === 'platform'` الأول.**
                    فمنتج للمنصة تصنيفه «مكتبة» كان الزرار هنا بيقول
                    «ابدأ التخصيص» ويوديه لمعالج القصة الكاملة، بينما
                    زرار نفس المنتج في المكتبة بيوديه لتخصيص الغلاف.
                    **نفس المنتج، نفس السعر، وشغل مختلف حسب الزرار.**

                    دلوقتي المسار من التصنيف وحده — مصدر واحد في
                    `customizationPath`. */}
                {unavailable ? (
                  // قرار ٢٤ أكتوبر: المنتج اللي بالتوصيل بس والتوصيل متوقف
                  // بيقول ده هنا — مش بعد ما العميل يملا التخصيص.
                  <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center">
                    <p className="font-black text-amber-900">غير متاح مؤقتًا</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-amber-900">
                      {unavailable} — المنتج ده بيتشحن بس، وبيرجع أول ما التوصيل يفتح.
                    </p>
                    <Link
                      href="/enha-lak"
                      className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-amber-900 underline underline-offset-4"
                    >
                      تصفّح باقي المنتجات
                    </Link>
                  </div>
                ) : customization ? (
                  <Button
                    href={customization.href}
                    accentColor="rose"
                    className={
                      product.category === 'custom'
                        ? 'w-full justify-center !bg-slate-900 !text-white hover:!bg-slate-800'
                        : 'w-full justify-center !bg-emerald-600 hover:!bg-emerald-700'
                    }
                  >
                    {customization.label}
                  </Button>
                ) : (
                  <AddToCartButton 
                    product={{
                      id: product.id,
                      productId: product.id,
                      name: product.name,
                      price: product.price,
                      quantity: 1,
                      type: 'custom',
                      imageUrl: product.coverImageUrl || undefined
                    }} 
                  />
                )}
                {/* ⚠️ **زرار «ابعته لحد يحبه» اتشال من هنا** (قرار تامر،
                    ١٥ أكتوبر): كان مكرّرًا — قسم المشاركة الكامل تحت في
                    آخر الصفحة بيعمل نفس الحاجة، وزرار تاني جنب زرار
                    الشراء كان بيسحب العين بعيد عن الشراء. */}
              </div>
            </Card>
          </div>
        </div>

        {/* Share Section */}
        <div className="mt-16 border-t border-slate-200 pt-10">
          <ShareSection
            title="مشاركة هذا الإصدار"
            subtitle="شارك هذا الكتاب أو القصة مع الأصدقاء والعائلة عبر وسائل التواصل"
            theme="rose"
            data={{
              title: product.name,
              description: product.shortDescription,
              url: `/enha-lak/product/${product.slug}`,
              shortPath: `/s/p/${product.id ? product.id.split('-')[0] : product.slug}`,
            }}
          />
        </div>
      </Section>
    </PageContainer>
  );
}
