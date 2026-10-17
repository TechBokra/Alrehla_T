import Link from 'next/link';
import { Clock, Heart, LayoutGrid, X } from 'lucide-react';
import { CategoryIcon } from '@/components/aqlam/CategoryBadge';
import { AGE_BANDS, type AgeBandId } from '@/lib/age-bands';
import { AQLAM_CATEGORIES, type AqlamCategory } from '@/lib/aqlam/post';
import { aqlamListHref } from '@/lib/aqlam/list-url';
import type { AqlamSort } from '@/data/domains/(shared)/aqlam/types';

/**
 * فلاتر قائمة «أقلام الرحلة»: النوع والسن والترتيب.
 *
 * روابط عادية (من غير JavaScript): كل اختيار رابط، والصفحة بتتبني على الخادم.
 * ⚠️ الاختيار الحالي مش باللون وحده: `aria-current` + علامة ظاهرة (خلفية غامقة
 *    ونص أبيض) — واللون المميّز للسن موجود من قبل في بقية الموقع.
 * ⚠️ الصفوف بتتحرك أفقيًا على الموبايل بدل ما تلف على سطور كتير وتاخد الشاشة.
 */

const pill =
  'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 focus-visible:outline-none ';
const pillOff = 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50';
const pillOn = 'border-slate-900 bg-slate-900 text-white shadow-sm';
const row = '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[4rem_1fr] md:items-center">
      <span className="text-xs font-black tracking-wide text-slate-500">{label}</span>
      <div className={row}>{children}</div>
    </div>
  );
}

export function AqlamFilters({
  category,
  band,
  sort,
}: {
  category: AqlamCategory | null;
  band: AgeBandId | null;
  sort: AqlamSort;
}) {
  const cur = { c: category, a: band, s: sort };
  const active = Boolean(category || band || sort !== 'new');

  return (
    <nav aria-label="تصفية النصوص" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <Group label="النوع">
        <Link
          href={aqlamListHref({ ...cur, c: null })}
          className={pill + (!category ? pillOn : pillOff)}
          aria-current={!category ? 'true' : undefined}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          الكل
        </Link>
        {AQLAM_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={aqlamListHref({ ...cur, c: c.key })}
            className={pill + (category === c.key ? pillOn : pillOff)}
            aria-current={category === c.key ? 'true' : undefined}
          >
            <CategoryIcon category={c.key} className="h-4 w-4" />
            {c.label}
          </Link>
        ))}
      </Group>

      <Group label="السن">
        <Link
          href={aqlamListHref({ ...cur, a: null })}
          className={pill + (!band ? pillOn : pillOff)}
          aria-current={!band ? 'true' : undefined}
        >
          الكل
        </Link>
        {AGE_BANDS.map((b) => (
          <Link
            key={b.id}
            href={aqlamListHref({ ...cur, a: b.id })}
            className={pill + (band === b.id ? b.tone.chipActive : b.tone.chip)}
            aria-current={band === b.id ? 'true' : undefined}
          >
            {b.label}
          </Link>
        ))}
      </Group>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black tracking-wide text-slate-500">الترتيب</span>
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            <Link
              href={aqlamListHref({ ...cur, s: 'new' })}
              aria-current={sort === 'new' ? 'true' : undefined}
              className={
                'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-sm font-bold focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ' +
                (sort === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')
              }
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              الأحدث
            </Link>
            <Link
              href={aqlamListHref({ ...cur, s: 'top' })}
              aria-current={sort === 'top' ? 'true' : undefined}
              className={
                'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-sm font-bold focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ' +
                (sort === 'top' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')
              }
            >
              <Heart className="h-4 w-4" aria-hidden="true" />
              الأكتر تشجيعًا
            </Link>
          </div>
        </div>
        {active && (
          <Link
            href="/aqlam"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-bold text-slate-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            مسح التصفية
          </Link>
        )}
      </div>
    </nav>
  );
}
