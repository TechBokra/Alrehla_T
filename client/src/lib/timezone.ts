/**
 * التوقيت المحلي للمنصة.
 *
 * ── المشكلة اللي الملف ده بيحلها ─────────────────────────────
 *
 * `buildSessionSchedule` كان بيبني التاريخ بـ`setHours()`، وهي بتشتغل
 * بالتوقيت المحلي **للخادم** — وخادم Vercel بيشتغل UTC. يعني المدرب
 * اللي بيختار «18:00» جلساته كانت بتتسجّل 18:00 UTC، والمستخدم في مصر
 * بيشوفها **21:00**. تلات ساعات فرق في كل جلسة.
 *
 * وكمان: الجمع بـ«سبع أيام = 7×24 ساعة» بيزحلق الساعة ساعة كاملة لما
 * التوقيت الصيفي يبدأ أو يخلص. مصر رجّعت التوقيت الصيفي، فده بيحصل
 * مرتين في السنة — باقة من عشر جلسات بتعدّي عليه.
 *
 * ── الحل ─────────────────────────────────────────────────────
 *
 * كل الحساب بيتم بـ«ساعة الحيطة» في القاهرة، والتحويل لـUTC بيحصل في
 * آخر خطوة بالإزاحة الصح **في التاريخ ده تحديدًا** — فالتوقيت الصيفي
 * بيتحسب لوحده بلا أرقام مكتوبة في الكود.
 */

export const PLATFORM_TIMEZONE = 'Africa/Cairo';

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: PLATFORM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export type CairoParts = {
  year: number;
  /** 1–12، مش 0–11. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = الأحد. */
  weekday: number;
};

/** اللحظة دي بتبان إزاي على ساعة الحيطة في القاهرة. */
export function cairoParts(date: Date): CairoParts {
  const out: Record<string, string> = {};
  for (const p of PARTS.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // منتصف الليل بيطلع "24" في بعض البيئات.
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAY_INDEX[out.weekday] ?? 0,
  };
}

/** إزاحة القاهرة عن UTC باللحظة دي (بالملّي ثانية). بتتغيّر مع التوقيت الصيفي. */
function cairoOffsetMs(date: Date): number {
  const p = cairoParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/**
 * ساعة حيطة في القاهرة ← اللحظة المقابلة لها بـUTC.
 *
 * بتتكرّر مرتين عن قصد: أول تخمين بيستخدم إزاحة اللحظة الخطأ، والتانية
 * بتستخدم إزاحة اللحظة الصح — وده بيظبط الحالات اللي على حدود التوقيت
 * الصيفي.
 */
export function cairoWallClockToUtc(w: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): Date {
  const naive = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0, 0);
  let ts = naive;
  for (let i = 0; i < 2; i += 1) {
    ts = naive - cairoOffsetMs(new Date(ts));
  }
  return new Date(ts);
}

/** نفس ساعة الحيطة بعد `days` يوم في تقويم القاهرة. */
export function addCairoDays(w: CairoParts, days: number): CairoParts {
  // التقويم بيتحرّك في فضاء UTC (بلا إزاحة) عشان الأيام تبقى أيام
  // تقويمية مش 24 ساعة — ده اللي بيخلي الميعاد ثابت على ساعة الحيطة
  // حتى لو التوقيت الصيفي اتغيّر في النص.
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day));
  d.setUTCDate(d.getUTCDate() + days);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: w.hour,
    minute: w.minute,
    second: 0,
    weekday: d.getUTCDay(),
  };
}

/** الساعة على ساعة الحيطة، بصيغة "HH:mm". */
export function cairoTimeLabel(date: Date): string {
  const p = cairoParts(date);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** تنسيق موحّد لعرض التواريخ للمستخدم — بتوقيت القاهرة دايمًا. */
export function formatCairo(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'short' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ar-EG', { ...options, timeZone: PLATFORM_TIMEZONE });
}
