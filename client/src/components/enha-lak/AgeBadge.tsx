import React from 'react';
import { Compass, Feather, Rocket, Sprout, type LucideIcon } from 'lucide-react';
import { ageLabel, primaryAgeBand, type AgeBandId } from '@/lib/age-bands';
import { cn } from '@/lib/utils';

/**
 * أيقونة كل فئة — نفس الأيقونة على شارة الكارت وعلى زرار الفلتر،
 * فالأب اللي اختار «🚀 ١٠–١٢» بيلاقي نفس الصاروخ على الكتب.
 *
 * ⚠️ **الأيقونة مش بديل عن النص** (درس ٣٣): الشارة فيها السنّ مكتوب
 *    دايمًا، والأيقونة `aria-hidden`.
 */
export const AGE_BAND_ICONS: Record<AgeBandId, LucideIcon> = {
  '6-9': Sprout,
  '10-12': Rocket,
  '13-17': Compass,
  '18-20': Feather,
};

/**
 * شارة السنّ — «ملصق» على الغلاف.
 *
 * ⚠️ **النص هو المدى الحقيقي** («من ٨ لـ١١ سنة») مش اسم الفئة: كتاب
 *    «٨–١١» لونه لون فئة «٦–٩» (أصغر سنّ)، لكن المكتوب عليه بيقول
 *    الحقيقة كاملة. اللون تقريب، النص معلومة.
 *
 * ومن غير سنّ **مفيش شارة** — لا «غير محدد» ولا «كل الأعمار»: الشارة
 * الفاضية بتتقري وعد، و«كل الأعمار» ادعاء محدّش قاله.
 */
export function AgeBadge({
  minAge,
  maxAge,
  className,
  size = 'sm',
}: {
  minAge?: number | null;
  maxAge?: number | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const band = primaryAgeBand({ minAge, maxAge });
  const label = ageLabel(minAge, maxAge);
  if (!band || !label) return null;

  const Icon = AGE_BAND_ICONS[band.id];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 font-bold shadow-sm',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        band.tone.chip,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      {label}
    </span>
  );
}
