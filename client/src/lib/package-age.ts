import type { AgeGroup } from '@/types';

/**
 * الطفل ده ينفع يتسجّل في الباقة دي؟ — نسخة الشاشة من حارس القاعدة.
 *
 * ── القرار ───────────────────────────────────────────────────
 *
 * تامر (٢٤ أكتوبر، بند ١٠): **منع + استثناء إداري**. الطفل مايتسجّلش في
 * باقة مش لسنّه، إلا لو الإدارة حطّت له استثناء على ملفه.
 *
 * ⚠️ **الحارس الحقيقي في القاعدة** (`guard_course_booking_rules`، ترحيل
 *    ٢٤ أكتوبر). الملف ده بس عشان الشاشة تقفل الاختيار وتقول السبب
 *    **قبل** ما ولي الأمر يدوس «احجز» ويتفاجئ برسالة خطأ.
 *    والحساب لازم يطابق `child_age_group` في القاعدة بالحرف:
 *    السن بالسنين الكاملة بتوقيت القاهرة، و١٢ بالظبط = «١٢ فأكثر».
 */

export type ChildForAge = {
  name: string;
  birthDate: string | null;
  ageGroupOverride?: AgeGroup | null;
};

export type AgeFit =
  | { ok: true }
  | {
      ok: false;
      reason: 'no_birth_date' | 'too_young' | 'too_old';
      message: string;
    };

/** تاريخ النهارده بتوقيت القاهرة (YYYY-MM-DD). */
function cairoToday(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = parts.split('-').map(Number);
  return { y, m, d };
}

/** السن بالسنين الكاملة. `null` لو التاريخ مش صالح. */
export function ageInYears(birthDate: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!match) return null;
  const [by, bm, bd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const t = cairoToday(now);
  let age = t.y - by;
  if (t.m < bm || (t.m === bm && t.d < bd)) age -= 1;
  return age;
}

export function childAgeGroup(
  child: ChildForAge,
  now = new Date()
): AgeGroup | null {
  if (
    child.ageGroupOverride === 'under_12' ||
    child.ageGroupOverride === '12_plus'
  ) {
    return child.ageGroupOverride;
  }
  if (!child.birthDate) return null;
  const age = ageInYears(child.birthDate, now);
  if (age === null) return null;
  return age < 12 ? 'under_12' : '12_plus';
}

export function childFitsPackage(
  child: ChildForAge,
  packageAgeGroup: AgeGroup,
  now = new Date()
): AgeFit {
  const group = childAgeGroup(child, now);
  if (group === null) {
    return {
      ok: false,
      reason: 'no_birth_date',
      message: `سجّل تاريخ ميلاد ${child.name} من «عائلتي» الأول.`,
    };
  }
  if (group === packageAgeGroup) return { ok: true };
  return packageAgeGroup === 'under_12'
    ? { ok: false, reason: 'too_old', message: 'الباقة دي لأقل من ١٢ سنة.' }
    : { ok: false, reason: 'too_young', message: 'الباقة دي لـ١٢ سنة فأكثر.' };
}
