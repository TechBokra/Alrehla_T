import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { getPublicPost, listPublicComments } from '@/data/domains/(shared)/aqlam/queries';
import { ageBandById } from '@/lib/age-bands';
import { categoryLabel } from '@/lib/aqlam/post';
import { pageMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/utils';
import { requireAqlamReadable, robotsFor } from '../../gate';
import { PostActions } from './PostActions';

/**
 * صفحة النص — **بتتخزّن مؤقتًا دقيقة** (ISR)، فالقارئ العادي مش بيضرب
 * القاعدة. التفاعل (ملصقات/تعليقات) في جزيرة عميل واحدة تحت النص، والنص
 * نفسه نص عادي (`whitespace-pre-wrap`) من غير أي HTML.
 *
 * الفهرسة: بس لو (١) الوضع «عام» و(٢) الكاتب ١٢+ ووافق صراحة.
 */
export const revalidate = 60;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const aqlam = await requireAqlamReadable();
  const { id } = await params;
  const post = await getPublicPost(id);
  if (!post) return { title: 'النص غير موجود', robots: { index: false, follow: false } };

  const indexable = post.allowIndexing && post.ageGroup === '12_plus';
  const meta = await pageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/aqlam/p/${post.id}`,
    image: post.shareCardUrl ?? undefined,
    type: 'article',
    publishedTime: post.publishedAt ?? undefined,
    noIndex: !indexable || aqlam.mode !== 'public',
  });
  const robots = robotsFor(aqlam, indexable);
  return robots ? { ...meta, robots } : meta;
}

export default async function AqlamPostPage({ params }: { params: Params }) {
  await requireAqlamReadable();
  const { id } = await params;
  const post = await getPublicPost(id);
  if (!post) notFound();

  const comments = post.commentsEnabled ? await listPublicComments(post.id) : [];
  const band = post.ageBand ? ageBandById(post.ageBand) : null;

  return (
    <PageContainer>
      <Section containerClassName="max-w-3xl space-y-6">
        <Link
          href="/aqlam"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          كل النصوص
        </Link>

        <article className="space-y-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {post.category && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {categoryLabel(post.category)}
                </span>
              )}
              {band && (
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${band.tone.chip}`}>
                  {band.label}
                </span>
              )}
            </div>
            <h1 className="text-3xl leading-tight font-black text-slate-900 md:text-5xl">{post.title}</h1>
            <p className="text-sm font-bold text-slate-500">
              {post.displayName}
              {post.publishedAt && ` · ${formatDate(post.publishedAt)}`}
            </p>
          </header>

          <div className="text-lg leading-loose font-medium whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">
            {post.body}
          </div>
        </article>

        <PostActions
          postId={post.id}
          title={post.title}
          reactionCount={post.reactionCount}
          commentsEnabled={post.commentsEnabled}
          comments={comments.map((c) => ({
            id: c.id,
            author: c.authorDisplayName,
            isInstructor: c.isInstructor,
            body: c.body,
            date: formatDate(c.createdAt),
          }))}
        />
      </Section>
    </PageContainer>
  );
}
