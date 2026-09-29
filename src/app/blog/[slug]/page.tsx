import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { PageContainer } from '@/components/PageContainer';
import { ArrowLeft, Calendar, User, BookOpen } from 'lucide-react';
import { getBlogPosts, getBlogPostBySlug } from '@/data/domains/content';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { RichText } from '@/components/ui/RichText';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { articleSchema, breadcrumbSchema } from '@/lib/structured-data';
import { getSiteSettings } from '@/data/domains/content';
import { ShareSection } from '@/components/share/ShareSection';


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = await getBlogPostBySlug(resolvedParams.slug);
  if (!post) return { title: 'مقال غير موجود' };
  return pageMetadata({
    title: post.title,
    description: post.excerpt || post.title,
    path: `/blog/${post.slug}`,
    image: post.coverImageUrl,
    type: 'article',
    publishedTime: post.publishedAt || undefined,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  // الاسم في الرابط بيوصل مشفّر لأن العناوين عربية، فالمقارنة النصية
  // المباشرة كانت بتفشل والمقال بيطلع «غير موجود» وهو موجود.
  const post = await getBlogPostBySlug(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const settings = await getSiteSettings();
  const siteName = settings.siteName?.trim() || 'الرحلة';

  return (
    <PageContainer className="!py-0 !space-y-0">
      <JsonLd
        data={[
          articleSchema({
            title: post.title,
            description: post.excerpt,
            image: post.coverImageUrl ? optimizedImageUrl(post.coverImageUrl, 1200) : undefined,
            path: `/blog/${post.slug}`,
            publishedAt: post.publishedAt || undefined,
            author: post.authorName,
            siteName,
          }),
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'المدونة', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />
      <Section containerClassName="max-w-4xl pt-12 pb-24">
        {/* Top Navigation */}
        <div className="mb-8">
          <Link href="/blog" className="inline-flex items-center gap-2 font-bold text-slate-500 hover:text-brand-strong transition-colors">
            <ArrowLeft className="h-4 w-4" />
            العودة للمدونة
          </Link>
        </div>

        {/* Article Header */}
        <header className="mb-12 text-center">
          <h1 className="mb-6 text-3xl font-black leading-tight text-slate-900 md:text-5xl">{post.title}</h1>
          
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-slate-500">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" />
              {formatDate(post.publishedAt)}
            </div>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-500" />
              {post.authorName || 'فريق الرحلة'}
            </div>
          </div>
        </header>

        {/* Cover Image */}
        <div className="relative mb-16 aspect-[21/9] w-full overflow-hidden rounded-[2rem] bg-slate-100 shadow-lg">
          {post.coverImageUrl ? (
            <Image 
              src={optimizedImageUrl(post.coverImageUrl, 1400)} 
              alt={post.title} 
              fill
              sizes="(max-width: 1024px) 100vw, 896px"
              priority
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <BookOpen className="h-24 w-24" />
            </div>
          )}
        </div>

        {/* Content */}
        {/* ══ 🔴 حاجتان كانتا مكسورتين هنا ═══════════════════════
            **①** الأصناف `prose*` **ميتة**. إضافة `@tailwindcss/typography`
            مثبَّتة في `package.json` لكنها **مش مسجَّلة** في `globals.css`
            (Tailwind 4 محتاج `@plugin`)، ومافيش ولا سطر `@plugin` في
            المشروع كله. اتأكّدت بالقياس على المنشور: المتغيّر
            `--tw-prose-body` **فاضي** — يعني كل صنف `prose` هنا
            مالوش أي أثر.

            ⚠️ نفس المصيدة اللي مسكناها في `hide-scrollbar`: الصنف
               اللي مالوش قاعدة **بيتجاهل في صمت**.

            **②** المحتوى كان بيتعرض **نصًّا خامًا** في
            `whitespace-pre-wrap`، والموقع كله بيستخدم `RichText`
            (الرئيسية والشروط والخصوصية) اللي بيحوّل `## عنوان`
            و`- نقطة` و`**عريض**` لعناصر حقيقية.

            ⚠️ **ومش مكسور اليوم**: المقالات المنشورة التلاتة فقرات
               عادية بلا أي تنسيق — قِستها. بيتكسر **أول ما حد يكتب
               `## عنوان`**، وساعتها هيطبع حرفيًّا كده «## عنوان».
               والفريق اللي هيكتب المحتوى بيستخدم نفس التنسيق ده في
               باقي الموقع.

            و`RichText` **مابيقبلش HTML خام عن قصد** — أي حد عنده
            صلاحية تعديل المحتوى كان هيقدر يحقن سكربت. */}
        <article className="mx-auto max-w-3xl">
          <p className="mb-8 text-xl leading-relaxed font-medium text-slate-600">
            {post.excerpt}
          </p>
          <RichText
            value={post.content}
            className="space-y-6 leading-loose text-slate-700"
          />
        </article>

        {/* Share Section */}
        <div className="mt-16 border-t border-slate-200 pt-10">
          <ShareSection
            title="شارك المقال"
            subtitle="انشر الفائدة وشارك المقال مع أصدقائك وعائلتك عبر وسائل التواصل"
            theme="amber"
            data={{
              title: post.title,
              description: post.excerpt,
              url: `/blog/${post.slug}`,
              shortPath: `/s/b/${post.id ? post.id.split('-')[0] : post.slug}`,
            }}
          />
        </div>
      </Section>
    </PageContainer>
  );
}
