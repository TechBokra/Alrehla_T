/**
 * المدرب الجديد اللي جاي من طلب انضمام: **هو اللي بيكمّل ملفه**.
 *
 * ── ليه ─────────────────────────────────────────────────────
 *
 * الإدارة بتقبل الطلب وهي مش عارفة تخصصات المدرب ولا سنين خبرته ولا
 * نبذته. فالحساب بيتعمل بالاسم والبريد بس، والمدرب أول ما يدخل بيلاقي
 * «كمّل ملفك» — ومايقدرش يعدّي من غير ما يملاه — وبعدها الملف بيروح
 * للإدارة تراجعه زي أي تعديل ملف (`profile_update_requests`).
 *
 * ── الحالات التلاتة ─────────────────────────────────────────
 *
 *   needs_profile  ← الملف ناقص ومفيش طلب مستني → يكمّله
 *   in_review      ← الملف ناقص بس فيه طلب مستني → مستني الإدارة
 *   complete       ← الملف فيه نبذة وتخصصات (اتعتمد)
 *
 * ⚠️ **«ناقص» = نبذة فاضية أو مفيش تخصصات** — وده بالظبط اللي
 *    `createInstructorFromJoinRequest` بيعمله. المدربين اللي الإدارة
 *    عملتهم بإيدها ببيانات كاملة مابيشوفوش الخطوة دي خالص.
 */

export type OnboardingState = 'needs_profile' | 'in_review' | 'complete';

export const BIO_MIN = 40;
export const YEARS_MAX = 60;

export function isProfileComplete(row: {
  bio?: string | null;
  specialties?: string[] | null;
}): boolean {
  return Boolean(row.bio?.trim()) && (row.specialties ?? []).some((s) => s.trim());
}

export function onboardingState(
  row: { bio?: string | null; specialties?: string[] | null },
  requests: { status: string; requestedChanges?: Record<string, unknown> | null }[],
): OnboardingState {
  if (isProfileComplete(row)) return 'complete';
  // طلب الباقات منفصل (`_requestType: 'packages'`) — مش ملف.
  const waiting = requests.some(
    (r) =>
      r.status === 'pending' &&
      (r.requestedChanges as { _requestType?: string } | null)?._requestType !== 'packages',
  );
  return waiting ? 'in_review' : 'needs_profile';
}

/**
 * فحص الملف الأول — **إلزامي كله**. بيرجّع رسالة لأول خانة ناقصة، أو `null`.
 *
 * ⚠️ نفس الفحص بيتعمل في الشاشة (عشان الرسالة تبان قبل الإرسال) وفي
 *    الخادم (عشان نداء مباشر مايعدّيش ملف فاضي) — قاعدة «ع».
 */
export function validateFirstProfile(input: {
  displayName: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  avatarUrl: string;
}): string | null {
  if (!input.avatarUrl.trim()) return 'ارفع صورتك الشخصية — بتظهر للأهالي في صفحتك.';
  if (input.displayName.trim().length < 2) return 'اكتب اسمك زي ما هيظهر للأهالي.';
  if (input.bio.trim().length < BIO_MIN) {
    return `النبذة قصيرة — اكتب ${BIO_MIN} حرف على الأقل عن خبرتك وأسلوبك.`;
  }
  if (input.specialties.filter((s) => s.trim()).length === 0) {
    return 'اكتب تخصص واحد على الأقل.';
  }
  const years = input.yearsExperience;
  if (!Number.isFinite(years) || years < 0 || years > YEARS_MAX) {
    return 'سنين الخبرة لازم تكون رقم من 0 لـ 60.';
  }
  return null;
}
