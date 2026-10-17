import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { getStandaloneServices } from '@/data/domains/(shared)/services/queries';
import { getProvidersForService } from '@/data/domains/(client)/services/queries';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
import { getWatermarkLayer } from '@/lib/watermark';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { addWatermark, optimizedImageUrl } from '@/lib/cloudinary';
import { PageContainer } from '@/components/PageContainer';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/ui/Section';
import { ServiceSteps, type ServiceCardData } from '@/components/creative-writing/ServiceCard';
import { ServicesBrowser } from '@/components/creative-writing/ServicesBrowser';
import { AdSlot } from '@/components/ads/AdSlot';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الخدمات الإبداعية',
    description:
      'خدمات إبداعية مستقلة من منصة الرحلة: مراجعة النصوص، الاستشارات، التحرير، والتعليق الصوتي.',
    path: '/creative-writing/services',
  });
}

/**
 * صفحة الخدمات الإبداعية — كروت بصور، وفلتر بالتصنيف، و«إزاي بتشتغل».
 *
 * ── اللي اتغيّر (ملاحظة تامر: «أضعف جزء في الموقع») ──────────
 *
 * • كانت كروت نص بس، متجمّعة تحت عناوين تصنيفات كبيرة، والسعر هو أكبر
 *   حاجة في الكارت. دلوقتي صورة الخدمة (ملف 09) ووصف قصير ومدة التسليم.
 * • زرار «اطلب الآن» كان بيودّي للدفع على طول. دلوقتي الكارت كله بيفتح
 *   **صفحة الخدمة** (التفاصيل والنماذج و«هتاخد إيه») ومنها الطلب.
 * • التصنيفات بقت أزرار فلتر فوق (`?category=`) — رابط يتبعت كمان. الفلتر في
 *   المتصفح (`ServicesBrowser`) عشان الصفحة تتخزّن وتتبعت جاهزة.
 *
 * ⚠️ السعر من **أرخص مقدّم معتمد** — نفس المصدر اللي الخادم بيحاسب منه
 *    (`getProvidersForService`). سعر الكتالوج بيظهر بس لو مفيش مقدّم.
 */
async function buildCards(): Promise<(ServiceCardData & { sortKey: number })[]> {
  const [services, wm] = await Promise.all([getStandaloneServices(), getWatermarkLayer()]);
  return Promise.all(
    services.map(async (service, index) => {
      const providers = await getProvidersForService(service.id);
      const prices = providers.map((p) => p.price);
      const available = providers.length > 0;
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        price: available ? Math.min(...prices) : service.price,
        startsFrom: service.priceType === 'starts_from' || new Set(prices).size > 1,
        deliveryDays: service.deliveryDays,
        imageUrl: service.coverImageUrl
          ? addWatermark(optimizedImageUrl(service.coverImageUrl, 800), wm)
          : undefined,
        available,
        sortKey: index,
      };
    }),
  );
}

export default async function ServicesPage() {
  const [cards, content, settings, wm] = await Promise.all([
    buildCards(),
    getSiteContent(),
    getSiteSettings(),
    getWatermarkLayer(),
  ]);

  // المتاح الأول، و«قريبًا» في الآخر — بنفس ترتيب الإدارة جوّه كل مجموعة.
  const sorted = [...cards]
    .sort((a, b) => Number(b.available) - Number(a.available) || a.sortKey - b.sortKey)
    .map(({ sortKey: _sortKey, ...card }) => card);
  const categories = [...new Set(sorted.map((c) => c.category).filter((c): c is string => Boolean(c)))];

  return (
    <>
      <PageHero
        image={settings.images.servicesHero}
        watermark={wm}
        title={content['services.title']}
        subtitle={content['services.description']}
        bandClassName="bg-emerald-50"
      />
      <AdSlot page="services" position="top" />
      <PageContainer className="!py-0 !space-y-0">

      <Section containerClassName="mx-auto w-full max-w-6xl pb-20">
        <ServicesBrowser cards={sorted} categories={categories} />
      </Section>

      <Section containerClassName="mx-auto w-full max-w-6xl pb-16">
        <h2 className="mb-6 text-center text-2xl font-black text-slate-800">إزاي بتشتغل؟</h2>
        <ServiceSteps />
      </Section>

      <Section containerClassName="pb-16">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center shadow-sm">
          <h3 className="mb-4 text-2xl font-black text-slate-800">{content['services.ctaTitle']}</h3>
          <p className="mb-8 font-medium text-slate-600">{content['services.ctaText']}</p>
          <Link
            href="/creative-writing/packages"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:-translate-y-1 hover:bg-slate-800 hover:shadow-lg"
          >
            استعرض باقات الكتابة <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </Section>
    <AdSlot page="services" position="bottom" />
    </PageContainer>
    </>
  );
}
