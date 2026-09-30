import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { PageContainer } from '@/components/PageContainer';
import { ArrowLeft, Calendar, User, BookOpen } from 'lucide-react';
import { getBlogPosts, getBlogPostBySlug } from '@/data/domains/content';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
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
        <article className="prose prose-slate prose-lg mx-auto prose-headings:font-black prose-a:text-brand-strong prose-img:rounded-2xl max-w-3xl">
          <p className="lead text-xl text-slate-600 font-medium leading-relaxed mb-8">
            {post.excerpt}
          </p>
          {/* The article's own body. Four invented paragraphs used to be printed
              here for every post, and post.content was never rendered at all. */}
          <div className="text-slate-700 leading-loose space-y-6 whitespace-pre-wrap">
            {post.content}
          </div>
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
