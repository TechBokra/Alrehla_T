'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Book, Search, ArrowUpDown, X, Building2, Sparkles } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { ProductCard } from '@/components/enha-lak/ProductCard';
import { AGE_BAND_ICONS } from '@/components/enha-lak/AgeBadge';
import { Reveal } from '@/components/ui/Reveal';
import {
  filterProducts,
  sortProducts,
  resultLabel,
  hasActiveFilter,
  PRODUCT_SORTS,
  type ProductSort,
} from '@/lib/product-display';
import { AGE_BANDS, isAgeBandId, productMatchesAgeBand, type AgeBandId } from '@/lib/age-bands';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import type { PersonalizedProduct, Publisher } from '@/types';

/**
 * شبكة المكتبة بفلاترها.
 *
 * ── تلات أعطال اتصلحت هنا قبل كده ───────────────────────────
 *
 * 🔴 **فلتر «مطبوع فقط» مكانش بيعمل حاجة** — فرع فاضي. اتشال.
 * 🔴 **«الأحدث» كانت بترتّب بالرقم** (`uuid` عشوائي). بقى بالتاريخ.
 * 🔴 **«لا توجد نتائج»** كانت بتظهر حتى والرفّ فاضي أصلًا.
 *
 * ── وفي ٣٠ سبتمبر: شكل «أنت البطل هنا» + فلترة كاملة ──────────
 *
 * • **الفلتر في الرابط** (`?age=6-9&publisher=<رابط الدار>`): الأب
 *   يبعت «كتب دار كذا لسن ٦–٩» على واتساب، وصفحة الناشر بتربط هنا
 *   بفلتر جاهز، وزرار الرجوع بيرجّع نفس الرفّ.
 * • **الناشر في الرابط باسمه المقروء (`slug`) مش برقمه**: الرقم
 *   `uuid` طويل وبيتقصّ في الرسائل.
 * • **الفئات العمرية** نفس حزم «بداية الرحلة» (`lib/age-bands.ts`).
 */

type Filters = {
  query: string;
  publisherSlug: string;
  ageBand: AgeBandId | 'all';
  sort: ProductSort;
};

const EMPTY: Filters = { query: '', publisherSlug: 'all', ageBand: 'all', sort: 'newest' };

/**
 * ⚠️ **ليه `Suspense` ونسختين من نفس الشاشة**
 *
 * `useSearchParams` في Next 15 بيخلّي الجزء اللي بيستعمله يترسم في
 * المتصفح بس. من غير `Suspense`، **الصفحة كلها** بتخرج من التخزين
 * المؤقت وبتتبني مع كل زيارة — والمكتبة صفحة عامة لازم تفتح بسرعة.
 *
 * فالخادم بيرسم الرفّ كامل من غير فلتر (`fallback`) — ده اللي محرّك
 * البحث بيشوفه — والمتصفح بيقرا الرابط ويطبّق الفلتر. والرابط من
 * غير فلتر (الأغلبية) مابيشوفش أي فرق.
 */
export function LibraryClient(props: {
  initialProducts: PersonalizedProduct[];
  publishers: Publisher[];
}) {
  return (
    <Suspense fallback={<LibraryView {...props} initial={EMPTY} />}>
      <LibraryFromUrl {...props} />
    </Suspense>
  );
}

function LibraryFromUrl(props: { initialProducts: PersonalizedProduct[]; publishers: Publisher[] }) {
  const params = useSearchParams();
  const age = params.get('age');
  const publisher = params.get('publisher');
  const sort = params.get('sort');

  // ⚠️ كل قيمة من الرابط بتتحقّق: الرابط بيتكتب ويتقصّ ويتعدّل باليد.
  //    القيمة الغريبة = «الكل»، مش رفّ فاضي.
  const initial: Filters = {
    query: params.get('q') ?? '',
    ageBand: isAgeBandId(age) ? age : 'all',
    publisherSlug: props.publishers.some((p) => p.slug === publisher) ? publisher! : 'all',
    sort: PRODUCT_SORTS.some((s) => s.value === sort) ? (sort as ProductSort) : 'newest',
  };

  return <LibraryView {...props} initial={initial} />;
}

function LibraryView({
  initialProducts,
  publishers,
  initial,
}: {
  initialProducts: PersonalizedProduct[];
  publishers: Publisher[];
  initial: Filters;
}) {
  const [f, setF] = useState<Filters>(initial);

  const update = (next: Partial<Filters>) => {
    const merged = { ...f, ...next };
    setF(merged);
    // ⚠️ `replaceState` لا `router.push`: كل حرف في البحث كان هيبقى
    //    خطوة في تاريخ المتصفح، والرجوع يمشي حرف حرف. ومن غير طلب
    //    للخادم — الفلترة كلها هنا.
    const q = new URLSearchParams();
    if (merged.ageBand !== 'all') q.set('age', merged.ageBand);
    if (merged.publisherSlug !== 'all') q.set('publisher', merged.publisherSlug);
    if (merged.sort !== 'newest') q.set('sort', merged.sort);
    if (merged.query.trim()) q.set('q', merged.query.trim());
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  };

  const publisherId =
    f.publisherSlug === 'all'
      ? 'all'
      : (publishers.find((p) => p.slug === f.publisherSlug)?.id ?? 'all');

  const filterOptions = { query: f.query, publisherId, ageBand: f.ageBand };

  const visible = useMemo(
    () => sortProducts(filterProducts(initialProducts, filterOptions), f.sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialProducts, f.query, publisherId, f.ageBand, f.sort],
  );

  const filtering = hasActiveFilter(filterOptions);
  const count = resultLabel(visible.length, initialProducts.length);
  const clear = () => update({ query: '', publisherSlug: 'all', ageBand: 'all' });

  // ⚠️ **الفئة اللي مالهاش ولا كتاب مابتظهرش** — نفس قاعدة دور النشر
  //    تحت. زرار بيدّي صفر نتايج دايمًا بيتقري «الموقع باظ».
  //    ⚠️ ويعني كمان: **لحد ما السنّ يتملا على الكتب، صفّ السنّ كله
  //    مستخبي** (تشخيص 131: ولا كتاب عليه سنّ). ده مقصود — مش عطل.
  const ageCounts = AGE_BANDS.map((band) => ({
    band,
    count: initialProducts.filter((p) => productMatchesAgeBand(p, band.id)).length,
  })).filter((x) => x.count > 0);

  // ⚠️ دور النشر: النشطة، مش التجريبية، واللي ليها كتاب هنا فعلًا.
  const usablePublishers = publishers.filter(
    (pub) =>
      pub.status === 'active' &&
      !pub.isSample &&
      initialProducts.some((p) => p.publisherId === pub.id),
  );

  // ⚠️ **على الموبايل الأزرار صفّ واحد بيتمرّر بالعرض، مش بتتلفّ.**
  //    ملفوفة كانت كل فئة في سطر لوحدها — الفلاتر بس كانت بتاخد
  //    شاشة كاملة قبل أول كتاب (اتقاست على ٣٩٠ بكسل).
  const chipBase =
    'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold whitespace-nowrap transition-[background-color,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-ui)] motion-safe:active:scale-95';

  return (
    // ⚠️ `w-full` مش زينة: `PageContainer` عموده `items-center`، فالقسم
    //    بياخد عرض محتواه. وصفّ الأزرار اللي بيتمرّر بالعرض كان بيمدّ
    //    القسم لعرض كل الأزرار — **فالصفحة كلها اتزحلقت يمين على
    //    الموبايل** بدل ما الصفّ يتمرّر جوّه مكانه. (اتمسكت بلقطة على
    //    ٣٩٠ بكسل.)
    <Section className="w-full pt-4 md:pt-6" containerClassName="max-w-6xl">
      <Card accentColor="rose" className="mb-6 space-y-5 rounded-[1.75rem] p-4 shadow-sm lg:p-6">
        {/* ══ السنّ ══════════════════════════════════════════════ */}
        {ageCounts.length > 0 && (
          <div role="group" aria-label="السنّ">
            <p className="mb-2 text-sm font-bold text-slate-700">لسنّ كام؟</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
              <button
                type="button"
                onClick={() => update({ ageBand: 'all' })}
                aria-pressed={f.ageBand === 'all'}
                className={cn(
                  chipBase,
                  f.ageBand === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400',
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                كل الأعمار
              </button>
              {ageCounts.map(({ band, count: n }) => {
                const Icon = AGE_BAND_ICONS[band.id];
                const active = f.ageBand === band.id;
                return (
                  <button
                    key={band.id}
                    type="button"
                    onClick={() => update({ ageBand: active ? 'all' : band.id })}
                    aria-pressed={active}
                    title={band.hint}
                    className={cn(chipBase, active ? band.tone.chipActive : band.tone.chip)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {band.label}
                    <span className="text-xs opacity-80">({n.toLocaleString('ar-EG')})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ دور النشر ════════════════════════════════════════
            ⚠️ كانت قايمة منسدلة — الاختيار مستخبي ورا ضغطة، والأب
            مايعرفش إن فيه دور نشر أصلًا لحد ما يفتحها. بقت أزرار
            ظاهرة بشعار كل دار. */}
        {usablePublishers.length > 0 && (
          <div role="group" aria-label="دار النشر">
            <p className="mb-2 text-sm font-bold text-slate-700">دار النشر</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
              <button
                type="button"
                onClick={() => update({ publisherSlug: 'all' })}
                aria-pressed={f.publisherSlug === 'all'}
                className={cn(
                  chipBase,
                  f.publisherSlug === 'all'
                    ? 'border-rose-700 bg-rose-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300',
                )}
              >
                كل دور النشر
              </button>
              {usablePublishers.map((pub) => {
                const active = f.publisherSlug === pub.slug;
                return (
                  <button
                    key={pub.id}
                    type="button"
                    onClick={() => update({ publisherSlug: active ? 'all' : pub.slug })}
                    aria-pressed={active}
                    className={cn(
                      chipBase,
                      'pr-1.5',
                      active
                        ? 'border-rose-700 bg-rose-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300',
                    )}
                  >
                    {/* الشعار لو موجود، وإلا أيقونة — مش أول حرف من
                        الاسم: «ا» لوحدها مابتقولش حاجة. */}
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                      {/* ⚠️ Cloudinary بس: `next/image` بيرفض أي مصدر مش في
                          `remotePatterns` **بخطأ يوقع الشاشة كلها** — والشعار
                          بيتكتب من ملف الناشر، يعني ممكن يكون أي رابط. */}
                      {pub.logoUrl?.startsWith('https://res.cloudinary.com/') ? (
                        <Image
                          src={optimizedImageUrl(pub.logoUrl, 64)}
                          alt=""
                          fill
                          sizes="32px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    {pub.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ البحث والترتيب ════════════════════════════════════ */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
              <Search className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="search"
              aria-label="ابحث في قصص المكتبة"
              placeholder="ابحث في قصص المكتبة…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-4 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              value={f.query}
              onChange={(e) => update({ query: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="hidden h-5 w-5 text-slate-500 sm:block" aria-hidden="true" />
            <select
              aria-label="الترتيب"
              className="min-w-[180px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              value={f.sort}
              onChange={(e) => update({ sort: e.target.value as ProductSort })}
            >
              {PRODUCT_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* ⚠️ العدد مش زينة: من غيره العميل اللي فلتر مايعرفش هو بيبصّ
          على الكل ولا على جزء، ولا إن الفلتر قصّ النتايج. */}
      {count && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p aria-live="polite" className="text-sm font-bold text-slate-600">
            {count}
          </p>
          {filtering && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-600 transition-colors hover:border-slate-400"
            >
              <X className="h-3.5 w-3.5" />
              امسح الفلاتر
            </button>
          )}
        </div>
      )}

      {visible.length > 0 ? (
        // ⚠️ **نفس شبكة «أنت البطل هنا»: ٣ أعمدة لا ٤** (الطلب: المكتبة
        //    بنفس الشكل). الأربعة كانت بتصغّر الغلاف لـ~٢٢٠ بكسل —
        //    والغلاف هو اللي بيبيع كتاب الأطفال.
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product, i) => (
            // ⚠️ التدرّج **مسقوف عند ٦**، و`h-full` لازم عشان الأزرار
            //    تتراصّ (التفصيل في تاريخ الملف).
            <Reveal key={product.id} delay={Math.min(i, 5) * 60} className="h-full">
              <ProductCard
                product={product}
                publisherName={publishers.find((p) => p.id === product.publisherId)?.name}
                cardHref={`/enha-lak/product/${product.slug}`}
                actionLabel="تخصيص الغلاف"
                actionHref={`/enha-lak/custom-library/${product.slug}`}
                detailsHref={`/enha-lak/product/${product.slug}`}
                detailsLabel="عرض تفاصيل القصة"
              />
            </Reveal>
          ))}
        </div>
      ) : (
        <Card
          accentColor="rose"
          className="flex flex-col items-center justify-center rounded-[1.75rem] py-20 text-center"
        >
          <Book className="mb-4 h-16 w-16 text-slate-300" />
          {/* ⚠️ رسالتان لا واحدة. «جرّب تغيير كلمات البحث» على رفّ
              فاضي بتقول للعميل إنه غلطان وهو مش غلطان. */}
          {filtering ? (
            <>
              <h2 className="mb-2 text-2xl font-black text-slate-800">مفيش نتايج</h2>
              <p className="mb-6 font-medium text-slate-600">
                جرّب كلمة تانية أو شيل الفلاتر.
              </p>
              <button
                type="button"
                onClick={clear}
                className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800"
              >
                اعرض كل الكتب
              </button>
            </>
          ) : (
            <>
              <h2 className="mb-2 text-2xl font-black text-slate-800">
                المكتبة لسه بتتجهّز
              </h2>
              <p className="font-medium text-slate-600">
                بنضيف إصدارات دور النشر أول بأول — ارجع لنا قريب.
              </p>
            </>
          )}
        </Card>
      )}
    </Section>
  );
}
