import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen, Pin } from 'lucide-react';
import { AqlamHero } from '@/components/aqlam/AqlamHero';
import { AqlamFilters } from '@/components/aqlam/AqlamFilters';
import { PostCard } from '@/components/aqlam/PostCard';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { listPinnedPosts, listPublicPosts } from '@/data/domains/(shared)/aqlam/queries';
import { getAqlamConfig } from '@/data/domains/(shared)/aqlam/config';
import type { AqlamPostCard } from '@/data/domains/(shared)/aqlam/types';
import { isAgeBandId, type AgeBandId } from '@/lib/age-bands';
import { enabledCategories, resolveSort, visibleAgeBands } from '@/lib/aqlam/config';
import { aqlamListHref } from '@/lib/aqlam/list-url';
import { pageMetadata } from '@/lib/seo';
import { requireAqlamReadable } from './gate';
import { AdSlot } from '@/components/ads/AdSlot';

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

export default async function AqlamPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAqlamReadable();
  const [settings, cfg] = await Promise.all([getSiteSettings(), getAqlamConfig()]);
  const sp = await searchParams;

  // فلتر مخفي أو قيمة مش مسموحة في الرابط ← بتتجاهل (الاعتماد على الإعداد الحالي).
  const category: string | null =
    cfg.filters.showCategory && enabledCategories(cfg).some((c) => c.key === sp.c) ? (sp.c ?? null) : null;
  const band: AgeBandId | null =
    cfg.filters.showAge && isAgeBandId(sp.a) && visibleAgeBands(cfg).some((b) => b.id === sp.a) ? sp.a : null;
  const sort = cfg.filters.showSort ? resolveSort(cfg, sp.s) : cfg.filters.defaultSort;
  const pageSize = cfg.filters.pageSize;
  const stripOn = cfg.featured.enabled;
  const stripFilters = cfg.featured.respectFilters ? { category, band } : {};
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.p ?? '1', 10) || 1));

  const [{ posts, hasMore }, pinned] = await Promise.all([
    listPublicPosts({ category, band, sort, page, pageSize, includePinned: !stripOn }),
    // «مختارات الرحلة» في أول صفحة بس. لو فشلت ماتوقّفش القائمة كلها.
    stripOn && page === 1
      ? listPinnedPosts(stripFilters).catch((e): AqlamPostCard[] => {
          console.error('aqlam pinned strip failed', e);
          return [];
        })
      : Promise.resolve([] as AqlamPostCard[]),
  ]);

  const current = { c: category, a: band, s: sort };
  const chip =
    'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ';
  const chipOff = 'border-slate-200 bg-white text-slate-700 hover:border-slate-400';

  return (
    <>
      <AqlamHero image={settings.images.aqlamHero} title={cfg.texts.heroTitle} subtitle={cfg.texts.heroSubtitle} />
      <AdSlot page="aqlam" position="top" />
      <PageContainer>
      <Section containerClassName="max-w-6xl space-y-8">
        <AqlamFilters cfg={cfg} category={category} band={band} sort={sort} />

        {pinned.length > 0 && (
          <section aria-labelledby="pinned" className="space-y-4 rounded-3xl bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-4 ring-1 ring-amber-200 md:p-6">
            <h2 id="pinned" className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Pin className="h-5 w-5 text-amber-600" aria-hidden="true" />
              {cfg.featured.title}
            </h2>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pinned.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} cfg={cfg} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {posts.length === 0 && pinned.length > 0 ? null : posts.length === 0 ? (
          <Card accentColor="amber" className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-slate-300" aria-hidden="true" />
            <p className="font-bold text-slate-600">
              {category || band ? 'مفيش نصوص بالاختيار ده لسه.' : cfg.texts.emptyMessage}
            </p>
            {!category && !band && cfg.features.publishing && (
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
                <PostCard post={post} cfg={cfg} />
              </li>
            ))}
          </ul>
        )}

        {(page > 1 || hasMore) && (
          <nav aria-label="الصفحات" className="flex items-center justify-between">
            {page > 1 ? (
              <Link href={aqlamListHref({ ...current, p: page - 1 }, cfg.filters.defaultSort)} className={chip + chipOff}>
                السابق
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-bold text-slate-500">
              صفحة {page.toLocaleString('ar-EG')} · {pageSize.toLocaleString('ar-EG')} نص في الصفحة
            </span>
            {hasMore ? (
              <Link href={aqlamListHref({ ...current, p: page + 1 }, cfg.filters.defaultSort)} className={chip + chipOff}>
                التالي
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Section>
      <AdSlot page="aqlam" position="bottom" />
      </PageContainer>
    </>
  );
}
