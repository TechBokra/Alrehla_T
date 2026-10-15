import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen, Star } from 'lucide-react';
import { AqlamHero } from '@/components/aqlam/AqlamHero';
import { CategoryIcon } from '@/components/aqlam/CategoryBadge';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { bandBar, bandBorder, bandSoft } from '@/lib/aqlam/look';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { listPublicPosts } from '@/data/domains/(shared)/aqlam/queries';
import { AQLAM_PAGE_SIZE } from '@/data/domains/(shared)/aqlam/types';
import { AGE_BANDS, ageBandById, isAgeBandId, type AgeBandId } from '@/lib/age-bands';
import { AQLAM_CATEGORIES, categoryLabel, isAqlamCategory, type AqlamCategory } from '@/lib/aqlam/post';
import { pageMetadata } from '@/lib/seo';
import { requireAqlamReadable } from './gate';

/**
 * قائمة النصوص. بتتفلتر بالتصنيف والفئة والترتيب من الرابط، فالصفحة
 * بتتبني على الخادم لكل زيارة (بدون JavaScript تفاعلي)، والاستعلام واحد
 * ومفهرس. صفحة النص نفسها (`/aqlam/p/…`) هي اللي بتتخزّن مؤقتًا.
 */

export async function generateMetadata(): Promise<Metadata> {
  const aqlam = await requireAqlamReadable();
  const meta = await pageMetadata({
    title: 'أقلام الرحلة',
    description: 'نصوص كتبها كتّاب صغار ويافعون: قصص وخواطر وقصائد.',
    path: '/aqlam',
    // القائمة نفسها مش مطلوبة في جوجل في التجريبي.
    noIndex: aqlam.mode !== 'public',
  });
  return meta;
}

type SearchParams = Promise<{ c?: string; a?: string; s?: string; p?: string }>;

function hrefFor(base: { c?: string; a?: string; s?: string; p?: number }) {
  const q = new URLSearchParams();
  if (base.c) q.set('c', base.c);
  if (base.a) q.set('a', base.a);
  if (base.s && base.s !== 'new') q.set('s', base.s);
  if (base.p && base.p > 1) q.set('p', String(base.p));
  const qs = q.toString();
  return qs ? `/aqlam?${qs}` : '/aqlam';
}

export default async function AqlamPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAqlamReadable();
  const settings = await getSiteSettings();
  const sp = await searchParams;

  const category: AqlamCategory | null = isAqlamCategory(sp.c) ? sp.c : null;
  const band: AgeBandId | null = isAgeBandId(sp.a) ? sp.a : null;
  const sort = sp.s === 'top' ? 'top' : 'new';
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.p ?? '1', 10) || 1));

  const { posts, hasMore } = await listPublicPosts({ category, band, sort, page });

  const current = { c: category ?? undefined, a: band ?? undefined, s: sort };
  const chip =
    'inline-flex min-h-[40px] items-center rounded-full border px-4 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ';
  const chipOff = 'border-slate-200 bg-white text-slate-700 hover:border-slate-400';
  const chipOn = 'border-slate-900 bg-slate-900 text-white';

  return (
    <>
      <AqlamHero image={settings.images.aqlamHero} />
      <PageContainer>
      <Section containerClassName="max-w-6xl space-y-8">
        <nav aria-label="تصفية النصوص" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-500">النوع:</span>
            <Link href={hrefFor({ ...current, c: undefined })} className={chip + (!category ? chipOn : chipOff)} aria-current={!category ? 'true' : undefined}>
              الكل
            </Link>
            {AQLAM_CATEGORIES.map((c) => (
              <Link
                key={c.key}
                href={hrefFor({ ...current, c: c.key })}
                className={chip + (category === c.key ? chipOn : chipOff)}
                aria-current={category === c.key ? 'true' : undefined}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-500">السن:</span>
            <Link href={hrefFor({ ...current, a: undefined })} className={chip + (!band ? chipOn : chipOff)} aria-current={!band ? 'true' : undefined}>
              الكل
            </Link>
            {AGE_BANDS.map((b) => (
              <Link
                key={b.id}
                href={hrefFor({ ...current, a: b.id })}
                className={chip + (band === b.id ? b.tone.chipActive : b.tone.chip)}
                aria-current={band === b.id ? 'true' : undefined}
              >
                {b.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-500">الترتيب:</span>
            <Link href={hrefFor({ ...current, s: 'new' })} className={chip + (sort === 'new' ? chipOn : chipOff)} aria-current={sort === 'new' ? 'true' : undefined}>
              الأحدث
            </Link>
            <Link href={hrefFor({ ...current, s: 'top' })} className={chip + (sort === 'top' ? chipOn : chipOff)} aria-current={sort === 'top' ? 'true' : undefined}>
              الأكتر تشجيعًا
            </Link>
          </div>
        </nav>

        {posts.length === 0 ? (
          <Card accentColor="amber" className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-slate-300" aria-hidden="true" />
            <p className="font-bold text-slate-600">
              {category || band ? 'مفيش نصوص بالاختيار ده لسه.' : 'لسه مفيش نصوص منشورة. كن أول من ينشر.'}
            </p>
            {!category && !band && (
              <Link
                href="/aqlam/publish"
                className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                انشر نصك
              </Link>
            )}
          </Card>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const band = post.ageBand ? ageBandById(post.ageBand) : null;
              return (
                <li key={post.id}>
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
                          {post.category && (
                            <span className="text-sm font-black text-slate-800">{categoryLabel(post.category)}</span>
                          )}
                          {band && (
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${band.tone.chip}`}>
                              {band.label}
                            </span>
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
                </li>
              );
            })}
          </ul>
        )}

        {(page > 1 || hasMore) && (
          <nav aria-label="الصفحات" className="flex items-center justify-between">
            {page > 1 ? (
              <Link href={hrefFor({ ...current, p: page - 1 })} className={chip + chipOff}>
                السابق
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-bold text-slate-500">
              صفحة {page.toLocaleString('ar-EG')} · {AQLAM_PAGE_SIZE.toLocaleString('ar-EG')} نص في الصفحة
            </span>
            {hasMore ? (
              <Link href={hrefFor({ ...current, p: page + 1 })} className={chip + chipOff}>
                التالي
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Section>
      </PageContainer>
    </>
  );
}
