import React from 'react';
import { getPublishers } from '@/data/domains/products';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Quote, BookOpen, PenTool, Search, Wand2, Gift } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/ui/Section';
import { optimizedImageUrl, slotImageUrl, slotImageUrlAt, blurPlaceholder } from '@/lib/cloudinary';
import { getSiteSettings, getSiteContent, getTestimonials } from '@/data/domains/content';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { RichText } from '@/components/ui/RichText';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { organizationSchema, websiteSchema } from '@/lib/structured-data';

export async function generateMetadata() {
  const [settings, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
  const name = settings.siteName?.trim() || 'الرحلة';
  return pageMetadata({
    title: `${name} · منصة الكتابة الإبداعية والقصص المخصصة`,
    titleAbsolute: true,
    description:
      content['home.hero.subtitle'] ||
      'منصة عربية لتعلّم الكتابة الإبداعية وتقديم قصص ومنتجات مخصصة للأطفال والشباب.',
    path: '/',
  });
}

/**
 * تلوين كلمتين في العنوان الرئيسي.
 *
 * العنوان بقى نصًا واحدًا قابلاً للتعديل من لوحة الإدارة، فالتلوين بقى
 * بالبحث عن الكلمتين: لو الإدارة غيّرت العنوان بالكامل، العنوان بيظهر
 * بلون واحد بدل ما يكسر.
 */
function HighlightedTitle({ title }: { title: string }) {
  const accents: [string, string][] = [
    ['الحكاية', 'text-amber-500'],
    ['صوتك', 'text-emerald-500'],
  ];
  const pattern = new RegExp(`(${accents.map(([w]) => w).join('|')})`, 'g');
  const parts = title.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const accent = accents.find(([word]) => word === part);
        return accent ? (
          <span key={i} className={accent[1]}>
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </>
  );
}

export default async function Home() {
  // Every image on this page used to come from picsum.photos — random stock
  // photographs standing in as the platform's own.
  const settings = await getSiteSettings();
  const content = await getSiteContent();
  // قسم آراء العملاء كان مربوطًا بمصفوفة فاضية مكتوبة في الكود، فكان بيقول
  // «قريبًا» دائمًا مهما كتبت الإدارة آراء في قاعدة البيانات.
  const testimonials = await getTestimonials();
  const publishers = await getPublishers();
  const activePublishers = publishers.filter((p: any) => p.status === 'active').slice(0, 4);
  const siteName = settings.siteName?.trim() || 'الرحلة';

  return (
    <div className="flex flex-col">
      {/* بيانات منظّمة: تعريف الجهة والموقع لمحركات البحث. */}
      <JsonLd
        data={[
          organizationSchema({
            name: siteName,
            description: content['home.hero.subtitle'] || '',
            logo: settings.images.logo
              ? slotImageUrl(settings.images.logo, 'logo')
              : undefined,
            email: settings.contactEmail || undefined,
            sameAs: [settings.facebookUrl, settings.instagramUrl],
          }),
          websiteSchema({ name: siteName }),
        ]}
      />

      {/* ── الهيرو — بعرض الصفحة، بلا أي تغميق على الصورة ──────

          كان قبل كده صندوقًا بخلفية `amber-50` وصورة **مخفية تمامًا على
          الموبايل** (`hidden lg:block`)، وفوق الصورة تدرّج
          `from-amber-50 to-transparent` بيغطّي نصّها.

          دلوقتي:
          • بعرض الصفحة كاملة، والصورة **بتبان على كل المقاسات**
          • **مفيش أي طبقة فوق الصورة** — ولا تدرّج ولا تغميق. ولوحة
            النص ليها خلفيتها البيضاء تحت الصورة ومتراكبة عليها شوية،
            فالنص مقروء والصورة بتفضل بألوانها الحقيقية. (ده نفس الحل
            اللي اتاخد في السلايدر قبل ما يتشال.)
          • نسبة أبعاد مش ارتفاع ثابت: 4:3 موبايل ← 16:9 ← 21:9
          • `alt=""` عن قصد — صورة زينة، والمعنى في الـ`h1` اللي جنبها

          ⚠️ **وكل مقاس بياخد قصّته من الصورة الأصلية.**

             قبل كده كانت الصورة بتتسلّم `21:9` دايمًا، و`object-cover`
             بيقصّها لـ4:3 على الموبايل — **قص فوق قص**: اللي بيبان
             الشريط الأوسط من صورة عريضة أصلًا، وأطرافها بتروح. وأغلب
             الزوار على الموبايل.

             دلوقتي `<picture>` بتطلب من Cloudinary قصّة مستقلة لكل
             مقاس، و`g_auto` بيحلّل **الأصل** في كل مرة. والمتصفح
             بيحمّل **واحدة بس** — اللي مقاسها مطابق، فالموبايل بياخد
             900 بكسل بدل 2100.

          ⚠️ **و`<picture>` مش `next/image` عن قصد**: `next/image`
             مبتعرفش تدّي قصّات مختلفة لمقاسات مختلفة (art direction)،
             وروابط Cloudinary دي متحوّلة أصلًا فـ`next/image` كانت
             بتمرّرها زي ما هي من غير ما تضيف حاجة.
      */}
      <section className="relative w-full">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 sm:aspect-[16/9] lg:aspect-[21/9]">
          {settings.images.homeHero ? (
            <picture>
              <source
                media="(min-width: 1024px)"
                srcSet={slotImageUrlAt(settings.images.homeHero, '21:9', 2100)}
              />
              <source
                media="(min-width: 640px)"
                srcSet={slotImageUrlAt(settings.images.homeHero, '16:9', 1400)}
              />
              <img
                src={slotImageUrlAt(settings.images.homeHero, '4:3', 900)}
                alt=""
                width={900}
                height={675}
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </picture>
          ) : (
            <ImagePlaceholder label="طفل يقرأ كتاباً" />
          )}
        </div>

        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="rounded-card relative -mt-16 bg-white/90 p-6 shadow-lg backdrop-blur-sm md:-mt-24 md:p-10 lg:max-w-2xl">
            <div className="mb-4 inline-flex w-fit items-center rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-strong">
              <Star className="ml-1.5 h-4 w-4" />
              {content['home.hero.badge']}
            </div>
            <h1 className="mb-6 text-3xl leading-tight font-black text-slate-800 md:text-5xl">
              <HighlightedTitle title={content['home.hero.title']} />
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed font-medium text-slate-600">
              {content['home.hero.subtitle']}
            </p>
            <div className="flex flex-wrap gap-4">
              {/* الزرارين بنفس اللون وبنفس الفعل: القسمين متساويين في
                  الأهمية، فمفيش سبب إن واحد يبان أساسي والتاني ثانوي.
                  الحركة (ارتفاع عند المرور وانضغاط عند الضغط) جاية من
                  `Button` نفسه — المرحلة ٤. */}
              <Button href="/enha-lak" size="lg">
                {content['home.hero.cta1']}
              </Button>
              <Button href="/creative-writing" size="lg">
                {content['home.hero.cta2']}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── ترتيب الصفحة ────────────────────────────────────
          هيرو ← أقسامنا الرئيسية ← قصتنا ← رحلتنا ← الشركاء ←
          التجارب ← المدونة. الترتيب ده بيحكي: إيه المنصة، بتعمل إيه،
          مين وراها، بتشتغل إزاي، مين شريكها، الناس قالت إيه، واقرا أكتر. */}
      {/* ── أقسامنا الرئيسية — بصور دلوقتي ──────────────────

          ⚠️ ده **عكس قرار سابق**: الصور اتشالت من هنا قبل كده لأنها
          كانت «بتملا فراغ مش بتقول حاجة». الفرق دلوقتي إن الصور بقت
          من خانات الإدارة (`homeReading` و`homeWriting`) — صور حقيقية
          للقسمين بيرفعها تامر، مش صور عامة بتملا مساحة.

          والخانتين **كانوا معرَّفين في `site-images.ts` من الأول
          ومفيش حاجة بتعرضهم** — بقايا من وقت ما الصور اتشالت. يعني
          كان ممكن يترفعوا صور وما تظهرش أبدًا.

          لو الخانة فاضية، الكارت بيرجع للأيقونة زي ما كان. */}
      <Section>
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-black text-slate-800">
            {content['home.pillars.title']}
          </h2>
          <p className="mx-auto max-w-2xl font-medium text-slate-500">
            {content['home.pillars.text']}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Link
            href="/enha-lak"
            className="group flex flex-col rounded-[2rem] border border-slate-200 bg-white p-10 transition-[box-shadow,transform,border-color] duration-[var(--dur-ui)] ease-[var(--ease-ui)] motion-safe:hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {settings.images.homeReading ? (
              <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-2xl">
                <Image
                  src={slotImageUrl(settings.images.homeReading, 'homeReading')}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-300 ease-[var(--ease-ui)] motion-safe:group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <BookOpen className="h-7 w-7" />
              </span>
            )}
            <h3 className="mb-4 text-2xl font-bold text-violet-700">
              {content['home.pillar.enhaLak.title']}
            </h3>
            <p className="flex-1 leading-relaxed font-medium text-slate-600">
              {content['home.pillar.enhaLak.text']}
            </p>
            <span className="mt-6 font-bold text-violet-700 group-hover:underline">
              ادخل القسم ←
            </span>
          </Link>

          <Link
            href="/creative-writing"
            className="group flex flex-col rounded-[2rem] border border-slate-200 bg-white p-10 transition-[box-shadow,transform,border-color] duration-[var(--dur-ui)] ease-[var(--ease-ui)] motion-safe:hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {settings.images.homeWriting ? (
              <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-2xl">
                <Image
                  src={slotImageUrl(settings.images.homeWriting, 'homeWriting')}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-300 ease-[var(--ease-ui)] motion-safe:group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <PenTool className="h-7 w-7" />
              </span>
            )}
            <h3 className="mb-4 text-2xl font-bold text-emerald-600">
              {content['home.pillar.writing.title']}
            </h3>
            <p className="flex-1 leading-relaxed font-medium text-slate-600">
              {content['home.pillar.writing.text']}
            </p>
            <span className="mt-6 font-bold text-emerald-700 group-hover:underline">
              ادخل القسم ←
            </span>
          </Link>
        </div>
      </Section>
      {/* Our Story */}
      <Section containerClassName="overflow-hidden rounded-[3rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/50 p-0">
        <div className="grid lg:grid-cols-2">
          {/* ── الصورة كبطاقة مائلة ──────────────────────────────

              الميل **على الشاشة الكبيرة بس** (`lg:`): على الموبايل
              العرض ضيّق والميل بياكل منه ويقرّب الصورة من حواف الشاشة.

              درجتان بس — كفاية إن العين تحسّها «مقصودة» من غير ما
              تبقى لعب. وبتتعدل لصفر عند المرور، فالحركة بتحصل ناحية
              الصورة زي ما هي ناحية الأزرار والكروت.

              والميل محتاج مساحة حواليه، عشان كده العمود بقى فيه
              `p-6 md:p-10` بدل ما الصورة تلزق في الحافة زي الأول. */}
          <div className="relative flex items-center justify-center p-6 md:p-10">
            <div className="rounded-card relative aspect-[4/3] w-full overflow-hidden shadow-xl transition-transform duration-300 ease-[var(--ease-ui)] lg:-rotate-2 motion-safe:lg:hover:rotate-0">
            {settings.images.homeFamily ? (
              <Image 
              src={slotImageUrl(settings.images.homeFamily, 'homeFamily')}
              alt="العائلة تقرأ معاً"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              placeholder={blurPlaceholder(settings.images.homeFamily) ? 'blur' : 'empty'}
              blurDataURL={blurPlaceholder(settings.images.homeFamily)}
              className="object-cover" referrerPolicy="no-referrer"
            />
            ) : (
              <ImagePlaceholder label="العائلة تقرأ معاً" />
            )}
            </div>
            {/* كان هنا تدرّج أبيض فوق الصورة (`to-white/90 lg:to-white`)
                بيغسلها لدرجة إنها تبان مربعًا فاضيًا على الشاشة الكبيرة.
                مكانش له داعي أصلًا: النص في العمود التاني مش فوق
                الصورة. اتشال — نفس قرار الهيرو: مفيش طبقة فوق أي صورة. */}
          </div>
          <div className="flex flex-col justify-center p-8 text-right md:p-12 lg:p-16">
            <h2 className="mb-8 text-3xl font-black text-slate-800">
              {content['home.story.title']}
            </h2>
            <RichText
              value={content['home.story.body']}
              className="mb-8 space-y-4 text-lg leading-relaxed font-medium text-slate-600"
            />
            <div>
              <Button href="/about" variant="secondary" accentColor="amber" className="!border-slate-200 !text-slate-700 hover:!border-amber-400">
                تعرّف إلى رحلتنا
              </Button>
            </div>
          </div>
        </div>
      </Section>
      {/* رحلتنا في 3 خطوات — شرح الفكرة قبل ما نطلب من الزائر أي حاجة. */}
      <Section containerClassName="max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['home.steps.title']}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { key: 'step1', icon: Search },
            { key: 'step2', icon: Wand2 },
            { key: 'step3', icon: Gift },
          ].map((step, index) => (
            <div key={step.key} className="text-center">
              <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <step.icon className="h-8 w-8" />
              </span>
              <div className="text-brand-strong mb-2 text-sm font-black">
                {index + 1}
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-800">
                {content[`home.${step.key}.title`]}
              </h3>
              <p className="leading-relaxed font-medium text-slate-600">
                {content[`home.${step.key}.text`]}
              </p>
            </div>
          ))}
        </div>
      </Section>
      {/* قسم المدربين اتشال من الصفحة الرئيسية: صفحة المدربين نفسها
          بتعرضهم بتفاصيل أوفى، والرئيسية المفروض تقول الفكرة مش تعرض
          كل حاجة. */}
      {/* Featured Publishers */}
      <Section>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">{content['home.publishers.title']}</h2>
            <p className="text-slate-500 font-medium max-w-2xl">{content['home.publishers.text']}</p>
          </div>
          <Button href="/enha-lak/library" variant="secondary" className="w-full md:w-auto">استكشف المكتبة</Button>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {activePublishers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-medium">قريبًا</div>
        ) : activePublishers.map((publisher: any) => (
            <Link href={`/enha-lak/publisher/${publisher.slug}`} key={publisher.id} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 flex flex-col items-center text-center">
              <div className="mb-4 relative h-20 w-20 flex items-center justify-center">
                {publisher.logoUrl ? (
                  <Image 
                    src={optimizedImageUrl(publisher.logoUrl, 200)}
                    alt={publisher.name}
                    fill sizes="80px" className="object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center font-black text-xl">
                    {publisher.name.charAt(0)}
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{publisher.name}</h3>
              <p className="text-sm font-medium text-slate-500 line-clamp-2">{publisher.bio}</p>
            </Link>
          ))}
        </div>
      </Section>
      {/* Testimonials */}
      <Section>
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['home.testimonials.title']}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-medium">قريبًا</div>
        ) : testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="flex flex-col justify-between p-6">
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
      {/* Blog Teaser */}
      <Section containerClassName="max-w-4xl text-center">
        <h2 className="mb-6 text-3xl font-black text-slate-800">
          {content['home.blog.title']}
        </h2>
        <p className="mx-auto mb-8 max-w-2xl font-medium text-slate-500">
          {content['home.blog.text']}
        </p>
        <Button href="/blog" variant="neutral">
          تصفح المدونة
        </Button>
      </Section>
      {/* Final CTA */}
      <Section containerClassName="max-w-4xl pb-20 text-center">
        <h2 className="mb-10 text-4xl font-black text-slate-900">
          {content['home.cta.title']}
        </h2>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button href="/enha-lak" variant="primary" size="lg" className="!bg-blue-600 !text-white hover:!bg-blue-700 !shadow-blue-200">
            {content['home.cta.button1']}
          </Button>
          <Button href="/creative-writing/booking" variant="primary" accentColor="amber" size="lg">
            {content['home.cta.button2']}
          </Button>
        </div>
      </Section>
    </div>
  );
}
