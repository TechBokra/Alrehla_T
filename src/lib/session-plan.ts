import { cairoWallClockToUtc } from '@/lib/timezone';

/**
 * حساب الجلسة الجديدة قبل ما تتكتب.
 *
 * ── ليه الحساب ده في ملف لوحده ──────────────────────────────
 *
 * الملف ده حساب نقي بلا قاعدة بيانات ولا شاشة، عشان يتختبر. وكل
 * دالة فيه بتجاوب على سؤال غلطه بتكلّف:
 *
 *   • رقم الجلسة الجديدة — غلطه بيرفض الإدراج
 *   • دي جلسة زيادة عن المتعاقَد عليه؟ — غلطه بيدّي جلسة ببلاش
 */

/**
 * رقم الجلسة الجاية.
 *
 * ⚠️ **أكبر رقم + واحد، مش العدد + واحد.**
 *
 *    الاتنين بيدّوا نفس النتيجة **طول ما محدّش لغى ولا حذف جلسة**.
 *    أول ما جلسة تروح، العدّ بيرجّع رقم **اتاخد قبل كده**: اشتراك
 *    فيه جلسات ١ و٢ و٤ عدده تلاتة، فالعدّ بيقول «٤» وهو موجود.
 *
 *    ولو في القاعدة قيد تفرّد على (الاشتراك، الرقم) — والتشخيص 115
 *    بيسأل عنه — الإدراج بيترفض. ولو مفيش قيد، بيبقى فيه جلستين
 *    بنفس الرقم في لوحة الطالب، وده أوحش من الرفض لأنه بيعدّي.
 */
export function nextSessionNumber(existingNumbers: number[]): number {
  const valid = existingNumbers.filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) return 1;
  return Math.max(...valid) + 1;
}

export type SessionQuota = {
  /** عدد الجلسات في الباقة. `null` = الباقة مالهاش عدد. */
  contracted: number | null;
  /** المجدوَل فعلًا دلوقتي (الملغي مش محسوب). */
  scheduled: number;
  /** الباقي من المتعاقَد عليه. `null` لو الباقة بلا عدد. */
  remaining: number | null;
  /** الجلسة الجديدة دي زيادة عن المتعاقَد عليه؟ */
  isExtra: boolean;
};

/**
 * الجلسة الجديدة جوّه الباقة ولا زيادة عليها؟
 *
 * ⚠️ **ده السؤال الوحيد هنا اللي مش تقني.** الاشتراك اشترى عددًا
 *    محدّدًا، فإضافة جلسة بعد ما العدد خلص **بتدّي جلسة ببلاش**.
 *
 *    وده ممكن يكون مقصودًا تمامًا — تعويض عن جلسة المدرب غاب فيها،
 *    أو حصة إضافية قرّرتها الإدارة. **بس مستحيل يكون بالغلط.**
 *    فالشاشة بتقوله قبل الضغطة، والسبب بيتكتب ويتسجّل.
 *
 * ⚠️ **والباقة اللي مالهاش عدد مابتبقاش «صفر».** `null` معناها
 *    مانعرفش السقف، والفرق بينها وبين الصفر إن الصفر بيخلّي **كل**
 *    جلسة تبان زيادة فالتحذير بيفقد معناه من كتر ما يتكرر.
 */
export function sessionQuota(params: {
  packageSessions: number | null | undefined;
  scheduledCount: number;
}): SessionQuota {
  const contracted =
    typeof params.packageSessions === 'number' && params.packageSessions > 0
      ? params.packageSessions
      : null;
  const scheduled = Math.max(0, params.scheduledCount);

  if (contracted === null) {
    return { contracted: null, scheduled, remaining: null, isExtra: false };
  }

  return {
    contracted,
    scheduled,
    remaining: Math.max(0, contracted - scheduled),
    // الجلسة الجديدة هي رقم `scheduled + 1`. بتبقى زيادة لما العدد
    // المجدوَل يكون وصل للمتعاقَد عليه خلاص.
    isExtra: scheduled >= contracted,
  };
}

/** الجملة اللي بتظهر للإداري فوق الزرّ. */
export function quotaNotice(quota: SessionQuota): string {
  if (quota.contracted === null) {
    return `الباقة دي مالهاش عدد جلسات محدّد، فمفيش سقف نقارن بيه. المجدوَل دلوقتي ${quota.scheduled}.`;
  }
  if (quota.isExtra) {
    return `الباقة ${quota.contracted} جلسة، والمجدوَل ${quota.scheduled}. الجلسة دي **زيادة عن المتعاقَد عليه** — يعني جلسة ببلاش.`;
  }
  return `الباقة ${quota.contracted} جلسة، والمجدوَل ${quota.scheduled}. باقي ${quota.remaining}.`;
}

/** أقل مدة مقبولة بين دلوقتي وموعد الجلسة الجديدة. */
export const MIN_LEAD_MINUTES = 15;

/**
 * قراءة خانة `datetime-local` **على إنها ساعة حيطة في القاهرة**.
 *
 * ⚠️ **وده مش تشدّدًا.** الخانة دي بترجّع نصًّا بلا منطقة زمنية —
 *    `2026-10-05T17:00`. و`new Date()` بتقراه **بتوقيت الجهاز**.
 *
 *    يعني إداري بيشتغل من الرياض بيكتب «٥ العصر» فالجلسة تتسجّل
 *    ٤ العصر بتوقيت القاهرة، والمدرب والطالب يقعدوا مستنيين ساعة.
 *    والشاشة كلها بتعرض بتوقيت القاهرة، فالإداري نفسه مش هيلاحظ.
 *
 *    القراءة هنا بتتم على الخادم وبتوقيت المنصة الثابت، فالنتيجة
 *    واحدة مهما كان الجهاز فين.
 */
export function parseCairoInput(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }

  const at = cairoWallClockToUtc({ year, month, day, hour, minute });
  return Number.isNaN(at.getTime()) ? null : at;
}

export type ScheduleCheck = { ok: true; at: Date } | { ok: false; error: string };

/**
 * فحص الموعد.
 *
 * ⚠️ **الجلسة في الماضي مش ممنوعة بالمطلق — ممنوعة من غير قصد.**
 *    تسجيل جلسة حصلت فعلًا ومحدّش سجّلها حاجة واردة، لكنها مختلفة
 *    عن «الإداري كتب السنة غلط». فالماضي بيترفض هنا، والتسجيل
 *    الرجعي لو احتجناه بيبقى إجراء باسمه.
 *
 * ⚠️ **و`nbf` عند Daily بيفتح الغرفة قبل الموعد بربع ساعة** — يعني
 *    جلسة موعدها بعد خمس دقايق غرفتها بتبقى اتفتحت خلاص. القيد هنا
 *    بيمشي مع سلوك الغرفة بدل ما يناقضه.
 */
export function checkScheduleTime(value: string, now = Date.now()): ScheduleCheck {
  if (!value) return { ok: false, error: 'حدّد موعد الجلسة.' };

  const at = parseCairoInput(value);
  if (!at) return { ok: false, error: 'الموعد مش مقروء.' };

  if (at.getTime() < now + MIN_LEAD_MINUTES * 60 * 1000) {
    return {
      ok: false,
      error: `الموعد لازم يكون بعد ${MIN_LEAD_MINUTES} دقيقة من دلوقتي على الأقل — غرفة الجلسة بتفتح قبل الموعد بربع ساعة.`,
    };
  }

  // سنة كاملة قدّام: الرقم مش قاعدة عمل، ده حارس على الكتابة الغلط
  // (٢٠٢٧ بدل ٢٠٢٦ مثلًا) اللي بتخلّي جلسة تختفي من كل الشاشات.
  if (at.getTime() > now + 365 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: 'الموعد أبعد من سنة — اتأكّد من السنة.' };
  }

  return { ok: true, at };
}
