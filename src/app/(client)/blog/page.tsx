import { getWatermarkLayer } from '@/lib/watermark';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { getBlogPosts, getSiteContent } from '@/data/domains/content';
import { BookOpen, Calendar, ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';

import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { addWatermark, optimizedImageUrl } from '@/lib/cloudinary';



export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'المدونة',
    description: 'تصفح أحدث مقالات ونصائح منصة الرحلة.',
    path: '/blog',
  });
}

export default async function BlogPage() {
  const [posts, wm, content] = await Promise.all([
    getBlogPosts(),
    getWatermarkLayer(), // «على الكل»
    getSiteContent(),
  ]);

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Header */}
      <Section containerClassName="max-w-4xl space-y-6 text-center">
        <h1 className="text-4xl leading-tight font-black text-slate-900 md:text-6xl">
          {content['blog.title']}
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
          {content['blog.subtitle']}
        </p>

      </Section>

      {/* Blog Grid */}
      <Section containerClassName="max-w-6xl">
        {posts.length === 0 && (
          <Card
            accentColor="amber"
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <BookOpen className="mb-4 h-12 w-12 text-slate-300" />
            <p className="font-bold text-slate-600">{content['blog.empty']}</p>
          </Card>
        )}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <Reveal key={post.id} delay={Math.min(i, 5) * 60} className="h-full">
            <div className="relative group block h-full">
              <Card
                accentColor="amber"
                interactive
                className="flex h-full flex-col p-6 hover:shadow-xl"
              >
                <Link href={`/blog/${post.slug}`} className="block">
                  <div className="relative mb-6 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                    {post.coverImageUrl ? (
                      <Image src={addWatermark(optimizedImageUrl(post.coverImageUrl, 600), wm)} alt={`صورة مقال: ${post.title}`} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                    ) : (
                      <BookOpen className="h-12 w-12 text-slate-300" />
                    )}
                  </div>

                  <h3 className="mb-3 line-clamp-2 text-xl font-bold text-slate-900 transition-colors group-hover:text-brand-strong">
                    {post.title}
                  </h3>
                </Link>

                <p className="mb-6 line-clamp-3 text-sm leading-relaxed font-medium text-slate-600">
                  {post.excerpt}
                </p>

                <div className="mt-auto flex items-center justify-between text-xs font-bold text-slate-500 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(post.publishedAt)}
                  </div>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-brand-strong flex items-center gap-1.5 font-bold"
                  >
                    {content['blog.readMore']}
                    {/* ⚠️ كان `transition-all group-hover:gap-2` —
                        يعني حركة على `gap`، وهي **خاصية تخطيط**:
                        المتصفح بيعيد حساب مكان العناصر ٦٠ مرة في
                        الثانية. السهم دلوقتي بينزلق بـ`transform`،
                        واللي بيتعمل على كارت الشاشة من غير إعادة
                        حساب. و`-translate-x` لأن الاتجاه من اليمين
                        لليسار. */}
                    <ArrowLeft className="h-3 w-3 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-ui)] motion-safe:group-hover:-translate-x-1" />
                  </Link>
                </div>
              </Card>
            </div>
            </Reveal>
          ))}
        </div>
      </Section>

    </PageContainer>
  );
}
