import { Metadata } from 'next';
import Image from 'next/image';
import { pageMetadata } from '@/lib/seo';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'قسم إنها لك',
    description: 'تصفح المتجر واكتشف أحدث منتجات وإصدارات إنها لك.',
    path: '/enha-lak',
  });
}

import Link from 'next/link';

import { getTestimonials, getSiteContent, getSiteSettings } from '@/data/domains/content';
import { slotImageUrl } from '@/lib/cloudinary';

import { PageContainer } from '@/components/PageContainer';
import { SectionHeader } from '@/components/SectionHeader';




import {



  Fingerprint,
  BookOpen,
  PenTool,
  Sparkles,
  User,
  FileEdit,
  Wand2,
  Package,
  Quote,
} from 'lucide-react';




export default async function EnhaLakPage() {
  const testimonials = await getTestimonials();
  const content = await getSiteContent();
  const settings = await getSiteSettings();

  // الشرائح كانت في layout القسم، يعني بتظهر فوق كل صفحة جواه. مكانها
  // الصفحة الرئيسية للقسم وبس.


  // الأيقونات والألوان ثابتة؛ النصوص من لوحة الإدارة ← محتوى الصفحات.
  const benefits = [
    { key: 'benefit1', icon: Fingerprint, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'benefit2', icon: BookOpen, color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'benefit3', icon: Sparkles, color: 'text-rose-600', bg: 'bg-amber-50' },
  ].map((b) => ({
    ...b,
    title: content[`enhaLak.${b.key}.title`],
    description: content[`enhaLak.${b.key}.text`],
  }));

  const steps = [
    { key: 'step1', icon: User },
    { key: 'step2', icon: FileEdit },
    { key: 'step3', icon: Wand2 },
    { key: 'step4', icon: Package },
  ].map((s) => ({
    ...s,
    title: content[`enhaLak.${s.key}.title`],
    description: content[`enhaLak.${s.key}.text`],
  }));

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/*
        بانر القسم — صورة واحدة ساكنة بدل السلايدر.

        ── ليه السلايدر اتشال ───────────────────────────────────

        السلايدر كان بيعرض **تلات شرايح بنفس التلات وجهات بالظبط** اللي
        القسم اللي تحته بيعرضها كلها مرة واحدة: التخصيص والمكتبة والاشتراك.
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
      {settings.images.enhaLakSlide1 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8">
          <div className="rounded-card relative aspect-[4/3] w-full overflow-hidden shadow-sm sm:aspect-[16/9] lg:aspect-[21/9]">
            <Image
              src={slotImageUrl(settings.images.enhaLakSlide1, 'enhaLakSlide1')}
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
      <Section containerClassName="max-w-4xl text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 mb-6 leading-tight">
          {content['enhaLak.hero.title']}
        </h1>
        <p className="text-xl md:text-2xl font-medium text-slate-600 mb-8 leading-relaxed">
          {content['enhaLak.hero.subtitle']}
        </p>

      </Section>
      

      {/* Path Selection */}
      <Section containerClassName="max-w-5xl">
        <div className="grid gap-8 md:grid-cols-3">
          <Link
            href="/enha-lak/custom"
            className="group block h-full"
          >
            <Card accentColor="rose" className="h-full relative overflow-hidden p-8 text-center transition-all duration-300 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 md:text-right">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 transition-transform group-hover:scale-110 md:mx-0">
                <PenTool className="h-8 w-8" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-slate-800">
                {content['enhaLak.path1.title']}
              </h3>
              <p className="leading-relaxed font-medium text-slate-600">
                {content['enhaLak.path1.text']}
              </p>
            </Card>
          </Link>
          <Link
            href="/enha-lak/library"
            className="group block h-full"
          >
            <Card accentColor="rose" className="h-full relative overflow-hidden p-8 text-center transition-all duration-300 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 md:text-right">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-110 md:mx-0">
                <BookOpen className="h-8 w-8" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-slate-800">
                {content['enhaLak.path2.title']}
              </h3>
              <p className="leading-relaxed font-medium text-slate-600">
                {content['enhaLak.path2.text']}
              </p>
            </Card>
          </Link>
          <Link
            href="/enha-lak/subscription"
            className="group block h-full"
          >
            <Card accentColor="rose" className="h-full relative overflow-hidden p-8 text-center transition-all duration-300 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 md:text-right">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-transform group-hover:scale-110 md:mx-0">
                <Package className="h-8 w-8" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-slate-800">
                {content['enhaLak.path3.title']}
              </h3>
              <p className="leading-relaxed font-medium text-slate-600">
                {content['enhaLak.path3.text']}
              </p>
            </Card>
          </Link>
        </div>
      </Section>

      {/* Power of Personalization */}
      <Section containerClassName="max-w-6xl rounded-3xl border border-slate-100 bg-slate-50/50 p-8 md:p-12">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['enhaLak.benefits.title']}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="text-center">
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${benefit.bg} ${benefit.color} mb-6`}
                >
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-800">
                  {benefit.title}
                </h3>
                <p className="leading-relaxed font-medium text-slate-500">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* How it works */}
      <Section containerClassName="max-w-5xl">
        <h2 className="mb-16 text-center text-3xl font-black text-slate-800">
          {content['enhaLak.steps.title']}
        </h2>
        <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="absolute top-8 right-12 left-12 -z-10 hidden h-0.5 bg-slate-100 md:block"></div>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative text-center">
                <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-violet-100 bg-white text-violet-600 shadow-sm">
                  <Icon className="h-7 w-7" />
                  <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {index + 1}
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-800">
                  {step.title}
                </h3>
                <p className="text-sm font-medium text-slate-500">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Testimonials */}
      <Section containerClassName="max-w-6xl pb-24">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['enhaLak.testimonials.title']}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              accentColor="rose"
              className="flex flex-col justify-between p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <Quote className="mb-4 h-8 w-8 text-blue-200" />
                <p className="mb-6 leading-relaxed font-medium text-slate-600 italic">
                  "{testimonial.content}"
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-800">
                  {testimonial.authorName}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {testimonial.authorRole}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>


    </PageContainer>
  );
}
