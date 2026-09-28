import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الخدمات الإبداعية',
    description: 'خدمات إبداعية مستقلة من منصة الرحلة: مراجعة النصوص، الاستشارات، التحرير، والتعليق الصوتي.',
    path: '/creative-writing/services',
  });
}

import { formatPrice } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, FileEdit, Video, BookOpen, MessageCircle, Headphones, Sparkles } from 'lucide-react';
import { getStandaloneServices, getProvidersForService } from '@/data/domains/services';
import { PageContainer } from '@/components/PageContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { Section } from '@/components/ui/Section';
import { getSiteContent } from '@/data/domains/content';


/**
 * The catalogue itself now comes from the database. Only presentation —
 * which icon and colour a category wears — stays in code. This page used to
 * hold its own copy of the services; the two lists drifted apart and a
 * placeholder entry ended up live on the site.
 */
const CATEGORY_STYLE: Record<string, { icon: typeof FileEdit; color: string; borderColor: string }> = {
  'مراجعات': { icon: FileEdit, color: 'bg-blue-50 text-blue-600', borderColor: 'border-blue-100' },
  'قصص فيديو': { icon: Video, color: 'bg-purple-50 text-purple-600', borderColor: 'border-purple-100' },
  'نشر': { icon: BookOpen, color: 'bg-emerald-50 text-emerald-600', borderColor: 'border-emerald-100' },
  'استشارات': { icon: MessageCircle, color: 'bg-amber-50 text-amber-600', borderColor: 'border-amber-100' },
  'قصص مسموعة': { icon: Headphones, color: 'bg-rose-50 text-rose-600', borderColor: 'border-rose-100' },
};

const DEFAULT_STYLE = { icon: Sparkles, color: 'bg-slate-50 text-slate-600', borderColor: 'border-slate-100' };

type ServiceCard = {
  id: string;
  title: string;
  description: string;
  price: number;
  priceType: 'fixed' | 'starts_from';
  ctaText: string;
  ctaLink: string;
  available: boolean;
};

async function buildCategories() {
  const services = await getStandaloneServices();

  const cards: (ServiceCard & { category: string })[] = await Promise.all(
    services.map(async (service) => {
      // السعر بييجي من عرض مقدّم الخدمة المعتمد، **لكل الخدمات** — مش من
      // كتالوج الخدمات.
      //
      // قبل كده الخدمة ذات السعر الثابت كانت بتعرض سعر الكتالوج وتروح
      // لصفحة الطلب على طول. ده كان بيعمل حاجتين غلط: الطلب بيتعمل من
      // غير مقدّم خدمة مكلَّف بيه (فمحدش بياخد إشعار ومش بيظهر في لوحة
      // حد)، وأول ما يتعدّل سعر المنصة من اللوحة يختلف المعروض عن
      // المحاسَب.
      const providers = await getProvidersForService(service.id);
      const available = providers.length > 0;
      const price = available ? providers[0].price : service.price;

      // مقدّم واحد: الزائر ما يحتاجش يختار من واحد. أكتر من واحد: يختار.
      const single = providers.length === 1 ? providers[0] : null;

      return {
        id: service.id,
        category: service.category ?? 'خدمات أخرى',
        title: service.name,
        description: service.description,
        price,
        priceType: service.priceType,
        ctaText: !available
          ? 'قريباً'
          : single
            ? 'اطلب الآن'
            : 'عرض مقدمي الخدمة',
        ctaLink: single
          ? `/creative-writing/services/${service.id}/order?provider=${single.providerId}`
          : `/creative-writing/services/${service.id}`,
        available,
      };
    })
  );

  const grouped: { title: string; icon: typeof FileEdit; color: string; borderColor: string; services: ServiceCard[] }[] = [];
  for (const card of cards) {
    const { category, ...rest } = card;
    const existing = grouped.find((g) => g.title === category);
    if (existing) {
      existing.services.push(rest);
    } else {
      const style = CATEGORY_STYLE[category] ?? DEFAULT_STYLE;
      grouped.push({ title: category, ...style, services: [rest] });
    }
  }
  return grouped;
}

export default async function ServicesPage() {
  const [serviceCategories, content] = await Promise.all([buildCategories(), getSiteContent()]);
  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Header */}
      <Section containerClassName="pt-16 pb-12 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
          {content['services.title']}
        </h1>
        <p className="text-lg md:text-xl font-medium text-slate-600 leading-relaxed">
          {content['services.description']}
        </p>

      </Section>

      {/* Services Categories */}
      <Section containerClassName="mx-auto w-full max-w-6xl pb-24 space-y-16">
        {serviceCategories.map((category) => {
          const CategoryIcon = category.icon;
          return (
            <div key={category.title} className="relative">
              {/* Category Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className={`flex h-16 w-16 items-center justify-center rounded-3xl ${category.color}`}>
                  <CategoryIcon className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-black text-slate-800">{category.title}</h2>
              </div>
              
              {/* Category Services Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {category.services.map((service) => (
                  <div 
                    key={service.id} 
                    className={`flex flex-col rounded-3xl border-2 ${category.borderColor} bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg`}
                  >
                    <div className="mb-6 flex-1">
                      <div className="mb-3">
                        <h3 className="text-2xl font-black text-slate-800">
                          {service.title}
                        </h3>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-slate-600 min-h-[40px]">
                        {service.description}
                      </p>
                    </div>
                    
                    <div className="mt-auto border-t border-slate-100 pt-6">
                      <div className="mb-6 flex flex-col items-center text-center">
                        <span className="text-sm font-bold text-slate-500 mb-1">
                          {service.priceType === 'starts_from' ? 'يبدأ من' : 'السعر'}
                        </span>
                        <span className={`text-3xl font-black ${category.color.split(' ')[1]}`}>
                          {formatPrice(service.price)}
                        </span>
                      </div>
                      
                      <Link 
                        href={service.available ? service.ctaLink : '#'}
                        aria-disabled={!service.available}
                        className={`group flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold transition-colors ${
                          service.priceType === 'starts_from' 
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                            : 'bg-amber-500 text-white shadow-md hover:bg-amber-600 hover:shadow-amber-500/20'
                        }`}
                      >
                        {service.ctaText}
                        <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      {/* Packages Link */}
      <Section containerClassName="pb-16">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center shadow-sm">
          <h3 className="mb-4 text-2xl font-black text-slate-800">
            {content['services.ctaTitle']}
          </h3>
          <p className="mb-8 text-slate-600 font-medium">{content['services.ctaText']}</p>
          <Link
            href="/creative-writing/packages"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:-translate-y-1 hover:shadow-lg"
          >
            استعرض باقات الكتابة <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </Section>


    </PageContainer>
  );
}
