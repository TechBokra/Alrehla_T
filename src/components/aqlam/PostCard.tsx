import Link from 'next/link';
import { Star } from 'lucide-react';
import { CategoryIcon } from '@/components/aqlam/CategoryBadge';
import type { AqlamPostCard } from '@/data/domains/(shared)/aqlam/types';
import { ageBandById } from '@/lib/age-bands';
import { bandBar, bandBorder, bandSoft } from '@/lib/aqlam/look';
import { categoryLabel } from '@/lib/aqlam/post';

/** كارت نص في القوائم (الرئيسية وصفحة الكاتب) — لون حسب الفئة وأيقونة حسب النوع. */
export function PostCard({ post }: { post: AqlamPostCard }) {
  const band = post.ageBand ? ageBandById(post.ageBand) : null;
  return (
    <Link
      href={`/aqlam/p/${post.id}`}
      className="group block h-full rounded-3xl focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <article
        className={`relative flex h-full flex-col overflow-hidden rounded-3xl border bg-gradient-to-br p-6 pt-7 transition-transform motion-safe:duration-200 motion-safe:group-hover:-translate-y-1 ${bandSoft(post.ageBand)} ${bandBorder(post.ageBand)}`}
      >
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${bandBar(post.ageBand)}`} />
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm ring-1 ring-slate-200">
            <CategoryIcon category={post.category} className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {post.category && <span className="text-sm font-black text-slate-800">{categoryLabel(post.category)}</span>}
            {band && (
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${band.tone.chip}`}>{band.label}</span>
            )}
          </div>
          {post.featured && (
            <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-amber-950">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              مميّز
            </span>
          )}
        </div>
        <h2 className="mb-2 line-clamp-2 text-xl leading-snug font-black text-slate-900">{post.title}</h2>
        <p className="mb-5 line-clamp-4 text-[15px] leading-loose font-medium whitespace-pre-line text-slate-700">
          {post.excerpt}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/5 pt-3 text-xs font-bold text-slate-600">
          <span className="truncate">{post.displayName}</span>
          <span className="shrink-0">
            {post.reactionCount > 0 && `${post.reactionCount.toLocaleString('ar-EG')} تشجيع`}
            {post.reactionCount > 0 && post.commentCount > 0 && ' · '}
            {post.commentCount > 0 && `${post.commentCount.toLocaleString('ar-EG')} تعليق`}
          </span>
        </div>
      </article>
    </Link>
  );
}
