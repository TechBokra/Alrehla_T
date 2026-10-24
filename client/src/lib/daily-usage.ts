/**
 * حسابات تبويب «استهلاك القاعة» — من غير أي نداء شبكة.
 *
 * ── الطلب ───────────────────────────────────────────────────
 *
 * ملاحظة تامر (٢٤ أكتوبر): «اعمل تبويب خاص بالقاعة مرتبط بحساب Daily
 * بحيث يعرّفنا استخدامنا وإيه الباقي شهريًا للوصول لنهاية الحد المجاني».
 *
 * ── ليه ملف لوحده ───────────────────────────────────────────
 *
 * الأرقام دي بيتبني عليها قرار فلوس («نشترك إمتى؟»). فالحساب نفسه
 * لازم يتختبر من غير Daily — الأيام في الشهر، والباقي، وتاريخ الوصول
 * للحد، والتكلفة بعده.
 *
 * ⚠️ **كل التوقعات خطّية**: المعدّل اليومي لحد النهارده × أيام الشهر.
 *    ده تقريب صريح — أسبوع امتحانات أو إجازة بيغيّره. والشاشة بتكتب
 *    جنبه «تقدير».
 */

export type UsageForecast = {
  used: number;
  limit: number;
  /** الباقي من المجاني — مابينزلش تحت الصفر. */
  remaining: number;
  /** نسبة الاستهلاك، مقصوصة على ١٠٠ للشريط. */
  percent: number;
  /** النسبة الحقيقية (ممكن تعدّي ١٠٠). */
  rawPercent: number;
  daysInMonth: number;
  /** الأيام اللي عدّت، بما فيها النهارده. */
  daysElapsed: number;
  daysLeft: number;
  dailyAverage: number;
  projected: number;
  /** الباقي يكفي كام يوم بالمعدّل الحالي؟ `null` لو مفيش استهلاك. */
  daysOfRunway: number | null;
  /** اليوم (من الشهر) اللي هنوصل فيه للحد — `null` لو مش هنوصل الشهر ده. */
  limitHitDay: number | null;
  /** الدقايق الزيادة المتوقعة آخر الشهر. */
  projectedExtraMinutes: number;
  projectedExtraUsd: number;
  status: 'safe' | 'watch' | 'over_soon' | 'over';
};

export function daysInUtcMonth(now: Date): number {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  ).getUTCDate();
}

export function usageForecast(params: {
  used: number;
  limit: number;
  now: Date;
  usdPerExtraMinute: number;
}): UsageForecast {
  const { used, limit, now, usdPerExtraMinute } = params;
  const daysInMonth = daysInUtcMonth(now);
  const daysElapsed = Math.min(daysInMonth, Math.max(1, now.getUTCDate()));
  const daysLeft = daysInMonth - daysElapsed;

  const dailyAverage = used / daysElapsed;
  const projected = Math.round(dailyAverage * daysInMonth);
  const remaining = Math.max(0, limit - used);
  const rawPercent = limit > 0 ? Math.round((used / limit) * 100) : 0;

  let limitHitDay: number | null = null;
  if (used >= limit) {
    limitHitDay = daysElapsed;
  } else if (dailyAverage > 0) {
    const day = Math.ceil(limit / dailyAverage);
    limitHitDay = day <= daysInMonth ? day : null;
  }

  const daysOfRunway =
    dailyAverage > 0 ? Math.floor(remaining / dailyAverage) : null;
  const projectedExtraMinutes = Math.max(0, projected - limit);

  const status: UsageForecast['status'] =
    used >= limit
      ? 'over'
      : limitHitDay !== null
        ? 'over_soon'
        : rawPercent >= 70
          ? 'watch'
          : 'safe';

  return {
    used,
    limit,
    remaining,
    percent: Math.min(100, rawPercent),
    rawPercent,
    daysInMonth,
    daysElapsed,
    daysLeft,
    dailyAverage: Math.round(dailyAverage),
    projected,
    daysOfRunway,
    limitHitDay,
    projectedExtraMinutes,
    projectedExtraUsd:
      Math.round(projectedExtraMinutes * usdPerExtraMinute * 100) / 100,
    status,
  };
}

export const USAGE_STATUS_TEXT: Record<UsageForecast['status'], string> = {
  safe: 'في الأمان — بالمعدّل ده مش هنوصل للحد المجاني الشهر ده.',
  watch: 'استهلكنا أكتر من ٧٠٪، بس بالمعدّل الحالي هنخلّص الشهر جوّه الحد.',
  over_soon:
    'بالمعدّل الحالي هنعدّي الحد المجاني قبل آخر الشهر — ده وقت نقرّر الاشتراك.',
  over: 'عدّينا الحد المجاني الشهر ده. أي دقيقة زيادة بتتحسب على الكارت المسجّل في Daily.',
};
