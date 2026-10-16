import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { AqlamHero } from '@/components/aqlam/AqlamHero';
import { PostCard } from '@/components/aqlam/PostCard';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { listPublicPosts } from '@/data/domains/(shared)/aqlam/queries';
import { AQLAM_PAGE_SIZE } from '@/data/domains/(shared)/aqlam/types';
import { AGE_BANDS, isAgeBandId, type AgeBandId } from '@/lib/age-bands';
import { AQLAM_CATEGORIES, isAqlamCategory, type AqlamCategory } from '@/lib/aqlam/post';
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
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
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
