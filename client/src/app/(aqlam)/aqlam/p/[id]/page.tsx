import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { getAqlamConfig } from '@/data/domains/(shared)/aqlam/config';
import { getPublicPost, listPublicComments } from '@/data/domains/(shared)/aqlam/queries';
import { ageBandById } from '@/lib/age-bands';
import { categoryMeta, enabledReactions, enabledReportReasons } from '@/lib/aqlam/config';
import { bandBar, bandBorder, bandSoft, readingLook } from '@/lib/aqlam/look';
import { CategoryIcon } from '@/components/aqlam/CategoryBadge';
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
  const [post, cfg] = await Promise.all([getPublicPost(id), getAqlamConfig()]);
  if (!post) return { title: 'النص غير موجود', robots: { index: false, follow: false } };

  const indexable = cfg.features.googleIndexing && post.allowIndexing && post.ageGroup === '12_plus';
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
  const [post, cfg] = await Promise.all([getPublicPost(id), getAqlamConfig()]);
  if (!post) notFound();
  const meta = categoryMeta(cfg, post.category);

  const comments = post.commentsEnabled ? await listPublicComments(post.id) : [];
  const band = post.ageBand ? ageBandById(post.ageBand) : null;
  const look = readingLook(post.ageBand, post.category);

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

        <article className="space-y-8">
          <header
            className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br px-6 py-8 pt-9 text-center md:px-10 md:py-12 ${bandSoft(post.ageBand)} ${bandBorder(post.ageBand)}`}
          >
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-2 ${bandBar(post.ageBand)}`} />
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm ring-1 ring-slate-200">
              <CategoryIcon icon={meta?.icon} className="h-7 w-7" />
            </span>
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
              {meta && <span className="text-sm font-black text-slate-800">{meta.label}</span>}
              {band && (
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${band.tone.chip}`}>
                  {band.label}
                </span>
              )}
            </div>
            <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-black text-slate-900 [overflow-wrap:anywhere] md:text-5xl md:leading-tight">
              {post.title}
            </h1>
            <p className="mt-4 text-sm font-bold text-slate-600">
              بقلم{' '}
              {post.writerSlug && cfg.features.writerPages ? (
                <Link
                  href={`/aqlam/w/${post.writerSlug}`}
                  className="underline underline-offset-4 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                  {post.displayName}
                </Link>
              ) : (
                post.displayName
              )}
              {post.publishedAt && ` · ${formatDate(post.publishedAt)}`}
              {post.editedAt && ` · عُدّل ${formatDate(post.editedAt)}`}
            </p>
          </header>

          <div
            className={`font-medium whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere] ${look.text} ${look.wrap}`}
          >
            {post.body}
          </div>
        </article>

        <PostActions
          postId={post.id}
          title={post.title}
          reactionCount={post.reactionCount}
          commentsEnabled={post.commentsEnabled}
          commentsOpen={cfg.features.comments}
          reactions={enabledReactions(cfg).map((r) => ({ key: r.key, label: r.label, emoji: r.emoji }))}
          reportReasons={enabledReportReasons(cfg).map((r) => ({ key: r.key, label: r.label }))}
          commentMax={cfg.limits.commentMax}
          reportDetailsMax={cfg.limits.reportDetailsMax}
          showShare={cfg.features.share}
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
