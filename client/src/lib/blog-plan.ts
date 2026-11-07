/**
 * خطة محتوى المدونة (ملف 20261107110000).
 *
 * كل بند بيمشي «الكتابة ← المراجعة ← النشر»، وكل مرحلة مهمة في «مهامي»
 * لمسؤولها (سير العمل والتوزيع ← المدونة). البند بيخلص لوحده لما المقال
 * المربوط بيه يتنشر.
 */

export type BlogPlanStatus = 'writing' | 'review' | 'publishing' | 'done' | 'dropped';

export const BLOG_PLAN_STATUSES: BlogPlanStatus[] = ['writing', 'review', 'publishing', 'done', 'dropped'];
export const BLOG_PLAN_ACTIVE: BlogPlanStatus[] = ['writing', 'review', 'publishing'];

export const BLOG_PLAN_LABELS: Record<BlogPlanStatus, string> = {
  writing: 'الكتابة',
  review: 'المراجعة',
  publishing: 'النشر',
  done: 'اتنشر',
  dropped: 'اتلغى',
};

export function isBlogPlanStatus(v: unknown): v is BlogPlanStatus {
  return typeof v === 'string' && (BLOG_PLAN_STATUSES as string[]).includes(v);
}

/** المرحلة اللي بعدها (للزرار «التالي»)، أو null لو البند خلص. */
export function nextBlogPlanStatus(s: BlogPlanStatus): BlogPlanStatus | null {
  if (s === 'writing') return 'review';
  if (s === 'review') return 'publishing';
  if (s === 'publishing') return 'done';
  return null;
}

/** المرحلة اللي قبلها (رجوع للكتابة بعد ملاحظات المراجعة مثلًا). */
export function previousBlogPlanStatus(s: BlogPlanStatus): BlogPlanStatus | null {
  if (s === 'review') return 'writing';
  if (s === 'publishing') return 'review';
  return null;
}

export type BlogPlanInput = { title: string; notes: string; plannedFor: string };

export type BlogPlanProblem = { field: keyof BlogPlanInput; message: string } | null;

/** نفس قيود الجدول — الرسالة بالعربي قبل ما القاعدة ترفض. */
export function blogPlanProblem(input: BlogPlanInput): BlogPlanProblem {
  const title = input.title.trim();
  if (title.length < 3) return { field: 'title', message: 'اكتب عنوان المقال (٣ حروف على الأقل)' };
  if (title.length > 160) return { field: 'title', message: 'العنوان طويل — ١٦٠ حرف على الأكتر' };
  if (input.notes.length > 2000) return { field: 'notes', message: 'الملاحظات طويلة — ٢٠٠٠ حرف على الأكتر' };
  if (input.plannedFor && !/^\d{4}-\d{2}-\d{2}$/.test(input.plannedFor)) {
    return { field: 'plannedFor', message: 'التاريخ مش مفهوم' };
  }
  return null;
}

/** متأخر = ميعاد النشر عدّى والبند لسه ماخلصش (بتاريخ القاهرة). */
export function blogPlanLate(item: { status: BlogPlanStatus; plannedFor: string | null }, todayCairo: string): boolean {
  return !!item.plannedFor && BLOG_PLAN_ACTIVE.includes(item.status) && item.plannedFor < todayCairo;
}
