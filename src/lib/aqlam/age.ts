/**
 * سنّ الكاتب وفئته في «أقلام الرحلة» — **حساب نقي بلا شاشة ولا قاعدة**.
 *
 * ── ليه الحساب هنا ومش من حقل بيكتبه الكاتب ─────────────────
 *
 * القرار: تاريخ الميلاد بيتطلب **مرة واحدة** عند أول نشر، والمنصة هي اللي
 * بتحسب السنّ والفئة منه. الكاتب ما بيختارش فئته أبدًا — لأن «أنا عندي ١٣»
 * خانة بتتغيّر بضغطة، وقواعد الحماية (نشر مباشر ١٢+، مراجعة وموافقة ولي
 * أمر لأقل من ١٢) كلها مبنية على الفئة.
 *
 * ⚠️ **نفس الحساب مكتوب في القاعدة** (دالة `aqlam_age_on` في الـmigration).
 *    القاعدة هي الحارس الفعلي؛ الكود ده بيدّي رسالة واضحة قبل الوصول لها.
 *    وأي تعديل هنا لازم يتعمل هناك.
 *
 * ⚠️ **تاريخ الطفل الفاضي = أقل من ١٢** (زي ما ملفات الملفات الخاصة بتعمل
 *    أصلًا) — مش «بالغ» ولا «مجهول».
 */

import { cairoParts } from '@/lib/timezone';
import { AGE_BANDS, type AgeBandId } from '@/lib/age-bands';

/** الفئة اللي بتتحكم في القواعد: نشر مباشر أو لا، تعليق مفتوح أو لا. */
export type AqlamAgeGroup = 'under_12' | '12_plus';

/** أول سنّ بيتنشر فيه مباشرة. */
export const AQLAM_DIRECT_PUBLISH_AGE = 12;

/** أكبر عمر معقول لتاريخ ميلاد — بيرفض «١٩٠٠» اللي بتتكتب بالغلط. */
const MAX_PLAUSIBLE_AGE = 110;

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** «٢٠١٥-٠٣-٠٩» ← «2015-03-09» — الكاتب بيكتب بالكيبورد العربي. */
function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export type BirthDateResult =
  | { ok: true; iso: string; age: number }
  | { ok: false; error: string };

/**
 * السنّ بالسنين الكاملة في اللحظة دي (بتوقيت القاهرة).
 * `birthIso` لازم يكون `YYYY-MM-DD` صحيح — اللي مش صحيح بيرجّع `null`.
 */
export function ageOn(birthIso: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthIso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // `Date.UTC` بتقلب 31 فبراير لـ3 مارس بدل ما ترفضه — فبنقارن بعد التحويل.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  const today = cairoParts(now);
  let age = today.year - y;
  if (today.month < mo || (today.month === mo && today.day < d)) age -= 1;
  return age;
}

/**
 * تحقّق من تاريخ الميلاد اللي الكاتب كتبه (حساب مستقل).
 *
 * الكاتب المستقل لازم يكون ١٢ فأكبر. أقل من كده بيتكتب من حساب ابن مرتبط
 * بولي أمر (وده اللي فيه مراجعة وموافقة)، مش من حساب مستقل.
 */
export function parseBirthDate(raw: unknown, now: Date = new Date()): BirthDateResult {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'اكتب تاريخ ميلادك' };
  }
  const iso = toLatinDigits(raw.trim());
  const age = ageOn(iso, now);
  if (age === null) {
    return { ok: false, error: 'تاريخ الميلاد مش مظبوط — اكتبه بالشكل ٢٠١٠-٠٣-٢٥' };
  }
  if (age < 0) return { ok: false, error: 'تاريخ الميلاد في المستقبل' };
  if (age > MAX_PLAUSIBLE_AGE) return { ok: false, error: 'تاريخ الميلاد مش منطقي' };
  if (age < AQLAM_DIRECT_PUBLISH_AGE) {
    return {
      ok: false,
      error:
        'الحساب المستقل للنشر من ١٢ سنة فأكبر. الأصغر بينشر من حساب ابنه المرتبط بولي أمره.',
    };
  }
  return { ok: true, iso, age };
}

export function ageGroupOf(age: number | null): AqlamAgeGroup {
  // مجهول = أقل من ١٢. الأحوط، وبيطابق قاعدة الملفات الخاصة.
  if (age === null || age < AQLAM_DIRECT_PUBLISH_AGE) return 'under_12';
  return '12_plus';
}

/**
 * فئة العرض (٦–٩ / ١٠–١٢ / ١٣–١٧ / ١٨–٢٠) — نفس تقسيم «إنها لك».
 * خارج المدى (تحت ٦ أو فوق ٢٠) = `null`، والنص بيظهر في «الكل» بس.
 */
export function ageBandOf(age: number | null): AgeBandId | null {
  if (age === null) return null;
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max)?.id ?? null;
}
