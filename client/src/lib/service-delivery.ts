/**
 * مهلة تسليم الخدمات الإبداعية.
 *
 * المهلة الطبيعية 14 يومًا من **تأكيد الدفع** — مش من إنشاء الطلب، لأن
 * قبل الدفع مفيش التزام على مقدّم الخدمة.
 *
 * المهلة ممكن تتغيّر لطلب بعينه لو الطرفين اتفقوا على غير كده؛ الإدارة
 * بتعدّل `due_at` وبتكتب السبب في `due_note` عشان يفضل مكتوب ليه اتغيّرت.
 *
 * مفيش إجراء تلقائي على طلب متأخر: بيتعلّم «متأخر» وبيتبعت إشعار،
 * والقرار لإنسان. إلغاء طلب تلقائيًا ممكن يلغي شغل خلص فعلًا واتأخر
 * تسليمه يوم واحد.
 */
export const SERVICE_DUE_DAYS = 14;

/** قبل المهلة بكام يوم يتبعت التنبيه الأول. */
export const SERVICE_DUE_WARNING_DAYS = 3;

/** الحالات اللي الطلب فيها لسه مستنّي تسليم — غيرها مالهاش مهلة. */
export const OPEN_SERVICE_STATUSES = ['paid', 'in_progress'] as const;

export function isOverdue(dueAt: string | null | undefined, now = new Date()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

/** كام يوم فاضل (بالسالب لو المهلة عدّت). null لو مفيش مهلة. */
export function daysUntilDue(
  dueAt: string | null | undefined,
  now = new Date(),
): number | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** جملة جاهزة للعرض في الشاشات. */
export function dueLabel(dueAt: string | null | undefined, now = new Date()): string {
  const days = daysUntilDue(dueAt, now);
  if (days === null) return 'بدون مهلة محددة';
  if (days < 0) return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return 'المهلة تنتهي اليوم';
  return `باقي ${days} يوم`;
}
