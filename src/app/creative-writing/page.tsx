import { Metadata } from 'next';
import Image from 'next/image';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الكتابة الإبداعية',
    description: 'استكشف برامج ودورات الكتابة الإبداعية المتاحة.',
    path: '/creative-writing',
  });
}

import { getTestimonials, getSiteContent, getSiteSettings } from '@/data/domains/content';
import { slotImageUrl } from '@/lib/cloudinary';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';


import {
  PenTool,
  Target,
  Map,
  ShieldCheck,
  Heart,
  Sparkles,
  User,
  ArrowLeft,
  Quote,
} from 'lucide-react';

export default async function CreativeWritingPage() {
  const allTestimonials = await getTestimonials();
  // Filter for specific testimonials if possible, or just use them
  const testimonials = allTestimonials.filter((t) =>
    t.authorRole.includes('ولي')
  );

  const content = await getSiteContent();
  const settings = await getSiteSettings();

  // الشرائح كانت في layout القسم، يعني بتظهر فوق كل صفحة جواه.


  // الأيقونات والألوان ثابتة؛ النصوص من لوحة الإدارة ← محتوى الصفحات.
  const suitableFor = [
    { key: 'cw.suitable1', icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'cw.suitable2', icon: Target, color: 'text-teal-600', bg: 'bg-teal-50' },
    { key: 'cw.suitable3', icon: PenTool, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ].map((item) => ({ ...item, text: content[item.key] }));

  const features = [
    { key: 'feature1', icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'feature2', icon: PenTool, color: 'text-indigo-600', bg: 'bg-emerald-50' },
    { key: 'feature3', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'feature4', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ].map((f) => ({
    ...f,
    title: content[`cw.${f.key}.title`],
    description: content[`cw.${f.key}.text`],
  }));

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/*
        بانر القسم — صورة واحدة ساكنة بدل السلايدر.

        ── ليه السلايدر اتشال ───────────────────────────────────

        السلايدر كان بيعرض **تلات شرايح بنفس التلات وجهات بالظبط** اللي
        القسم اللي تحته بيعرضها كلها مرة واحدة: الباقات والمدربين والخدمات.
        يعني تكرار كامل، بس بيوريك واحدة في المرة بدل التلاتة.

        وكان معاه كمان:
          • **عنوان h1 تاني في نفس الصفحة** — كل شريحة فيها h1، وتحتها
            h1 الصفحة الحقيقي. ده يضر الفهرسة وقارئ الشاشة
          • `<img>` خام مش `next/image` — أتقل صورة في الصفحة بتتحمّل
            بحجمها الكامل على كل موبايل
          • ارتفاع ثابت 450px موبايل / 650px ديسكتوب = ~55٪ من شاشة
            الهاتف قبل ما المستخدم يقرا كلمة
          • تقدّم تلقائي مبيقفش لو المستخدم بيتفرج
          • خمس ألوان سمة زيادة (violet · teal) بتوسّع اللوحة بلا داعي

        ── والبديل ──────────────────────────────────────────────

        صورة واحدة **بنسبة أبعاد** مش بارتفاع ثابت، فبتتناسب مع الشاشة
        بدل ما تُقص عشوائيًا: 4:3 على الموبايل ← 16:9 ← 21:9 على الشاشة
        الكبيرة. و`alt=""` عن قصد: دي صورة زينة، والمعنى في الـh1 اللي
        تحتها؛ قارئ الشاشة يعدّيها بدل ما يقرا وصفًا مكرّرًا.
      */}
      {settings.images.creativeSlide1 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8">
          <div className="rounded-card relative aspect-[4/3] w-full overflow-hidden shadow-sm sm:aspect-[16/9] lg:aspect-[21/9]">
            <Image
              src={slotImageUrl(settings.images.creativeSlide1, 'creativeSlide1')}
              alt=""
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover"
              priority
            />
          </div>
        </section>
      )}

      {/* Hero Section */}
      <Section containerClassName="mx-auto max-w-4xl text-center pt-8">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 mb-6 leading-tight">
          {content['cw.hero.title']}
        </h1>
        <p className="text-xl md:text-2xl font-medium text-slate-600 mb-8 leading-relaxed">
          {content['cw.hero.subtitle']}
        </p>

      </Section>

      {/* Suitable For */}
      <Section containerClassName="mx-auto w-full max-w-6xl">
        <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-8 md:p-16">
          <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
            {content['cw.suitable.title']}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {suitableFor.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card
                  key={idx}
                  accentColor="emerald"
                  className="p-8 text-center"
                >
                  <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${item.bg} ${item.color} mb-6`}
                  >
                    <Icon className="h-8 w-8" />
                  </div>
                  <p className="text-lg leading-relaxed font-medium text-slate-600">
                    {item.text}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Features */}
      <Section containerClassName="mx-auto w-full max-w-5xl">
        <h2 className="mb-16 text-center text-3xl font-black text-slate-800">
          {content['cw.features.title']}
        </h2>
        <div className="grid gap-8 sm:grid-cols-2">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div key={idx} className="flex items-start gap-6">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${feature.bg} ${feature.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-bold text-slate-800">
                    {feature.title}
                  </h3>
                  <p className="leading-relaxed font-medium text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Pathways */}
      <Section containerClassName="mx-auto w-full max-w-4xl">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['cw.pathways.title']}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/creative-writing/packages"
            className="group block rounded-3xl border border-slate-200 bg-white p-8 transition-[box-shadow,transform,border-color] duration-[var(--dur-ui)] ease-[var(--ease-ui)] motion-safe:hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Map className="h-6 w-6" />
            </div>
            <h3 className="mb-3 text-2xl font-bold text-slate-800">
              {content['cw.pathway1.title']}
            </h3>
            <p className="mb-6 font-medium text-slate-600">
              {content['cw.pathway1.text']}
            </p>
            <span className="flex items-center gap-2 font-bold text-emerald-700">
              اكتشف الباقات <ArrowLeft className="h-4 w-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-ui)] motion-safe:group-hover:-translate-x-1" />
            </span>
          </Link>
          <Link
            href="/creative-writing/services"
            className="group block rounded-3xl border border-slate-200 bg-white p-8 transition-[box-shadow,transform,border-color] duration-[var(--dur-ui)] ease-[var(--ease-ui)] motion-safe:hover:-translate-y-1 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <PenTool className="h-6 w-6" />
            </div>
            <h3 className="mb-3 text-2xl font-bold text-slate-800">
              {content['cw.pathway2.title']}
            </h3>
            <p className="mb-6 font-medium text-slate-600">
              {content['cw.pathway2.text']}
            </p>
            <span className="flex items-center gap-2 font-bold text-teal-700">
              اكتشف الخدمات <ArrowLeft className="h-4 w-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-ui)] motion-safe:group-hover:-translate-x-1" />
            </span>
          </Link>
        </div>
      </Section>

      {/* Instructors Teaser */}
      <Section containerClassName="relative mx-auto w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-900 p-8 text-center text-white md:p-12">
        <div className="absolute top-0 right-0 -z-0 h-64 w-64 rounded-full bg-slate-800 blur-3xl"></div>
        <div className="relative z-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-slate-300">
            <User className="h-8 w-8" />
          </div>
          <h2 className="mb-6 text-3xl font-black">{content['cw.instructors.title']}</h2>
          <p className="mx-auto mb-8 max-w-2xl leading-relaxed font-medium text-slate-400">
            {content['cw.instructors.text']}
          </p>
          <Button
            href="/creative-writing/instructors"
            accentColor="emerald"
            className="!bg-white !text-slate-900 hover:!bg-slate-100"
          >
            تعرّف إلى المدربين
          </Button>
        </div>
      </Section>

      {/* Testimonials */}
      <Section containerClassName="mx-auto w-full max-w-5xl">
        <div className="grid gap-8 md:grid-cols-2">
          {testimonials.slice(0, 2).map((testimonial) => (
            <Card
              key={testimonial.id}
              accentColor="emerald"
              className="flex flex-col justify-between p-8"
            >
              <div>
                <Quote className="mb-6 h-10 w-10 text-emerald-200" />
                <p className="mb-8 text-lg leading-relaxed font-medium text-slate-700 italic">
                  "{testimonial.content}"
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-900">
                  {testimonial.authorName}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-500">
                  {testimonial.authorRole}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <Section containerClassName="mx-auto w-full max-w-4xl pb-20 text-center">
        <h2 className="mb-10 text-4xl font-black text-slate-900">
          {content['cw.cta.title']}
        </h2>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            href="/creative-writing/packages"
            accentColor="emerald"
          >
            استعرض الباقات
          </Button>
          <Button
            href="/creative-writing/services"
            variant="secondary"
            accentColor="emerald"
          >
            اختر خدمة مستقلة
          </Button>
        </div>
      </Section>


    </PageContainer>
  );
}
