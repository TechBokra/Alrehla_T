import Link from 'next/link';
import { PenLine, Feather, BookOpen, Star } from 'lucide-react';
import { slotImageUrlAt } from '@/lib/cloudinary';

/**
 * بانر أقلام الرحلة: صورة بعرض الصفحة (من خانة «بانر أقلام الرحلة» في
 * صور الموقع) وتحتها بطاقة العنوان متداخلة معاها — نفس بناء الرئيسية.
 *
 * ⚠️ لو الخانة فاضية، بيتعرض خلفية دافئة مرسومة بالأيقونات بدل مكان فاضي،
 *    فالصفحة بتبان مكتملة من أول يوم. والصورة نفسها `fetchPriority=high`
 *    لأنها أول حاجة في الشاشة (أهم صورة في تحميل الصفحة).
 */
export function AqlamHero({ image }: { image?: string }) {
  return (
    <section className="relative w-full">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-amber-50 sm:aspect-[16/9] lg:aspect-[21/9]">
        {image ? (
          <picture>
            <source media="(min-width: 1024px)" srcSet={slotImageUrlAt(image, '21:9', 2100)} />
            <source media="(min-width: 640px)" srcSet={slotImageUrlAt(image, '16:9', 1400)} />
            <img
              src={slotImageUrlAt(image, '4:3', 900)}
              alt=""
              width={900}
              height={675}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </picture>
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-amber-100 via-rose-50 to-emerald-100">
            <Feather className="absolute top-[18%] left-[12%] h-24 w-24 -rotate-12 text-amber-300/70 md:h-40 md:w-40" />
            <BookOpen className="absolute right-[14%] bottom-[22%] h-20 w-20 rotate-6 text-emerald-300/70 md:h-32 md:w-32" />
            <Star className="absolute top-[26%] right-[30%] h-10 w-10 text-rose-300/70 md:h-14 md:w-14" />
            <PenLine className="absolute bottom-[30%] left-[34%] h-12 w-12 rotate-12 text-sky-300/70 md:h-16 md:w-16" />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="rounded-card relative -mt-16 bg-white/95 p-6 shadow-lg backdrop-blur-sm md:-mt-24 md:p-10 lg:max-w-2xl">
          <h1 className="mb-3 text-4xl leading-tight font-black text-slate-900 md:text-5xl">أقلام الرحلة</h1>
          <p className="mb-6 text-lg leading-relaxed font-medium text-slate-600">
            قصص وقصائد وخواطر كتبها صغار ويافعون. اقرا، وشجّع بملصق أو تعليق طيّب، وانشر نصك لما تحب.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/aqlam/publish"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-slate-900 px-6 font-bold text-white shadow-md transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              انشر نصك
            </Link>
            <Link
              href="/aqlam/me"
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-300 px-6 font-bold text-slate-800 transition-colors hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              ملفي
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
