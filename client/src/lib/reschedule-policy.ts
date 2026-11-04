/**
 * سياسة تأجيل الجلسات — قرار تامر (٢٤ أكتوبر، بند ٦).
 *
 *   • الطلب **قبل الجلسة بـ٢٤ ساعة على الأقل** — للكل (ولي الأمر،
 *     الطالب، المدرب).
 *   • **مرتين بس في الباقة** لطلبات ولي الأمر/الطالب. المدرب مش
 *     محسوب عليه عدد — بس طلباته بتظهر للإدارة بعددها.
 *   • غياب الطالب من غير طلب = الجلسة **بتتحسب عليه** (تقرير المدرب
 *     بـ«لم يحضر» بيقفلها).
 *   • غياب المدرب = الجلسة **بتتعوّض**: الإدارة بتحدد موعد جديد لنفس
 *     الجلسة بدل ما تتقفل.
 *
 * ⚠️ **الإدارة مش محكومة بالقواعد دي.** تعديل الموعد من لوحة الإدارة
 *    (`updateSessionDetails`) هو طريق الاستثناء للظروف الطارئة.
 *
 * ⚠️ الطلب المرفوض مابيتحسبش من المرتين — صاحبه ماخدش حاجة.
 */

export const RESCHEDULE_NOTICE_HOURS = 24;
export const RESCHEDULE_MAX_PER_PACKAGE = 2;

export type RequesterRole = 'instructor' | 'guardian' | 'student';

export type RescheduleCheck =
  | { ok: true; remaining: number | null }
  | { ok: false; reason: 'too_late' | 'limit_reached'; message: string };

export function rescheduleAllowed(params: {
  role: RequesterRole;
  scheduledAt: string | Date;
  /** طلبات ولي الأمر/الطالب في نفس الباقة اللي حالتها pending أو approved. */
  usedInPackage: number;
  now?: Date;
}): RescheduleCheck {
  const now = params.now ?? new Date();
  const at = new Date(params.scheduledAt).getTime();
  const hoursLeft = (at - now.getTime()) / 3_600_000;

  if (!(hoursLeft >= RESCHEDULE_NOTICE_HOURS)) {
    return {
      ok: false,
      reason: 'too_late',
      message:
        `تغيير الموعد بيتطلب قبل الجلسة بـ${RESCHEDULE_NOTICE_HOURS} ساعة على الأقل. ` +
        'لو فيه ظرف طارئ، كلّم الإدارة من الدعم.',
    };
  }

  if (params.role === 'instructor') return { ok: true, remaining: null };

  const remaining = RESCHEDULE_MAX_PER_PACKAGE - params.usedInPackage;
  if (remaining <= 0) {
    return {
      ok: false,
      reason: 'limit_reached',
      message:
        `استخدمت مرات التأجيل المتاحة في الباقة دي (${RESCHEDULE_MAX_PER_PACKAGE} مرات). ` +
        'لو فيه ظرف طارئ، كلّم الإدارة من الدعم.',
    };
  }
  return { ok: true, remaining };
}

/** السطر اللي بيظهر جنب زرار «اطلب تغيير الموعد». */
export const RESCHEDULE_POLICY_TEXT =
  `التأجيل قبل الجلسة بـ${RESCHEDULE_NOTICE_HOURS} ساعة على الأقل، وبحد أقصى مرتين في الباقة. ` +
  'الغياب من غير طلب بيتحسب جلسة.';
