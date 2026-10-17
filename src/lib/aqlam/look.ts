import type { AgeBandId } from '@/lib/age-bands';
import { AGE_BANDS } from '@/lib/age-bands';

/**
 * الشكل المناسب للمحتوى والسن — **حساب نقي بلا شاشة**.
 *
 * ⚠️ الأصناف مكتوبة كاملة (مش متركّبة وقت التشغيل): Tailwind بيتجاهل
 *    `bg-${color}-100` في صمت.
 */

/** تدرّج خلفية البطاقة والرأس: لون الفئة، أو محايد خارج الفئات (٢١+). */
export function bandSoft(band: AgeBandId | null): string {
  const b = band ? AGE_BANDS.find((x) => x.id === band) : null;
  return b ? b.tone.soft : 'from-slate-50 via-white to-slate-100/70';
}

/** حدّ البطاقة بلون الفئة. */
export function bandBorder(band: AgeBandId | null): string {
  switch (band) {
    case '6-9':
      return 'border-amber-200';
    case '10-12':
      return 'border-sky-200';
    case '13-17':
      return 'border-violet-200';
    case '18-20':
      return 'border-emerald-200';
    default:
      return 'border-slate-200';
  }
}

/** لون شريط الأعلى في البطاقة. */
export function bandBar(band: AgeBandId | null): string {
  switch (band) {
    case '6-9':
      return 'bg-amber-400';
    case '10-12':
      return 'bg-sky-400';
    case '13-17':
      return 'bg-violet-400';
    case '18-20':
      return 'bg-emerald-400';
    default:
      return 'bg-slate-300';
  }
}

/**
 * مقاس خط القراءة وتباعد السطور: الأصغر سنًّا بيقرا بخط أكبر وتباعد أوسع،
 * والقصيدة متوسّطة بعرض أضيق، والمقال بعرض قراءة مريح.
 */
export function readingLook(
  band: AgeBandId | null,
  category: string,
): { text: string; wrap: string } {
  const text =
    band === '6-9'
      ? 'text-xl leading-[2.2] md:text-2xl md:leading-[2.2]'
      : band === '10-12'
        ? 'text-lg leading-[2.05] md:text-xl md:leading-[2.05]'
        : 'text-lg leading-loose';
  const wrap =
    category === 'poem'
      ? 'mx-auto max-w-xl text-center'
      : 'mx-auto max-w-2xl';
  return { text, wrap };
}
