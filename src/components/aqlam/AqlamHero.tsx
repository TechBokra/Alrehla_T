import { PenLine, Feather, BookOpen, Star } from 'lucide-react';
import { PageHero } from '@/components/PageHero';

/**
 * بانر أقلام الرحلة.
 *
 * ⚠️ **الشكل اتنقل لـ`PageHero`** — نفس البناء بالظبط كان مكتوب هنا
 *    وفي الرئيسية، وصفحتا «إنها لك» و«بداية الرحلة» كان عندهم شكل
 *    تالت خالص. اللي باقي هنا هو اللي يخص أقلام الرحلة وحدها: نصّها،
 *    ولينكاتها، وخلفيتها البديلة.
 *
 * ⚠️ **ومفيش علامة مائية على البانر ده** — زيّ ما كان. ده بانر القسم
 *    مش عمل منشور، والعلامة بتتحط على أعمال الأطفال.
 */
export function AqlamHero({ image }: { image?: string }) {
  return (
    <PageHero
      image={image}
      title="أقلام الرحلة"
      subtitle="قصص وقصائد وخواطر كتبها صغار ويافعون. اقرا، وشجّع بملصق أو تعليق طيّب، وانشر نصك لما تحب."
      bandClassName="bg-amber-50"
      links={[
        {
          href: '/aqlam/publish',
          label: 'انشر نصك',
          icon: <PenLine className="h-4 w-4" aria-hidden="true" />,
        },
        { href: '/aqlam/me', label: 'ملفي', look: 'outline' },
      ]}
      fallback={
        /* خلفية مرسومة بدل مكان فاضي — الصفحة بتبان مكتملة من أول يوم. */
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-amber-100 via-rose-50 to-emerald-100"
        >
          <Feather className="absolute top-[18%] left-[12%] h-24 w-24 -rotate-12 text-amber-300/70 md:h-40 md:w-40" />
          <BookOpen className="absolute right-[14%] bottom-[22%] h-20 w-20 rotate-6 text-emerald-300/70 md:h-32 md:w-32" />
          <Star className="absolute top-[26%] right-[30%] h-10 w-10 text-rose-300/70 md:h-14 md:w-14" />
          <PenLine className="absolute bottom-[30%] left-[34%] h-12 w-12 rotate-12 text-sky-300/70 md:h-16 md:w-16" />
        </div>
      }
    />
  );
}
