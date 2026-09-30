import React from 'react';
import { cn } from '@/lib/utils';

/**
 * رسومات زينة مرحة لقسم «إنها لك» — نجمة، سحابة، خط متعرّج، نقط.
 *
 * ── ليه SVG مكتوب هنا مش صور ────────────────────────────────
 *
 * «الشكل الطفولي» كان محتاج رسومات من فريق التصميم، ولسه مفيش. فدي
 * **أشكال بسيطة أصلية** (مش منقولة من أي علامة أو شخصية) بتدّي
 * الإحساس من غير ما تستنى:
 *   • **خفيفة**: كام سطر SVG بدل صور بتتحمّل
 *   • **بتاخد لون القسم** (`currentColor`)، فتغيير الهوية بعدين
 *     مابيحتاجش إعادة رسم
 *   • ولما صور الفريق توصل، المكوّن ده **بيتشال من مكان واحد**
 *
 * ⚠️ **`aria-hidden` و`pointer-events-none` على الكل**: زينة. قارئ
 *    الشاشة مايقراهاش، والضغطة بتعدّي من خلالها للي تحتها.
 *
 * ⚠️ **والحركة جوّه `motion-safe:`** وبطيئة (٧–٩ ثواني): اللي مفعّل
 *    «تقليل الحركة» بياخدها ساكنة. وحركة سريعة حوالين المحتوى بتشدّ
 *    العين بعيد عن الكتب — وده عكس المطلوب.
 */

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2.5l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.4 6.4 19.6l1.4-6.3L3 9l6.4-.6z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Cloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M18 38h32a12 12 0 0 0 1.5-23.9A16 16 0 0 0 21 12.2 13 13 0 0 0 18 38z"
      />
    </svg>
  );
}

export function Squiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 24" className={className} aria-hidden="true" focusable="false">
      <path
        d="M2 12c10-12 20-12 30 0s20 12 30 0 20-12 30 0 16 10 26 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Dots({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      {[6, 20, 34].flatMap((x) =>
        [6, 20, 34].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="currentColor" />),
      )}
    </svg>
  );
}

/** طبقة زينة تتحط جوّه عنصر `relative`. */
export function KidsDoodles({ className }: { className?: string }) {
  const float = 'motion-safe:animate-[kids-float_8s_ease-in-out_infinite]';
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <Star className={cn('absolute top-6 right-[8%] h-7 w-7 text-amber-300', float)} />
      <Star className="absolute bottom-10 left-[12%] h-5 w-5 rotate-12 text-rose-300" />
      <Cloud className={cn('absolute top-8 left-[6%] h-10 w-16 text-sky-100', float, 'motion-safe:[animation-delay:-3s]')} />
      <Cloud className="absolute right-[18%] bottom-6 hidden h-8 w-12 text-violet-100 md:block" />
      <Squiggle className="absolute bottom-4 left-1/2 hidden h-4 w-28 -translate-x-1/2 text-rose-200 md:block" />
      <Dots className="absolute top-1/2 right-[3%] hidden h-8 w-8 -translate-y-1/2 text-emerald-200 lg:block" />
    </div>
  );
}
