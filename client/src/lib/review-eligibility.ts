/**
 * إمتى ينفع الطالب يقيّم المدرب؟
 *
 * ── الطلب ───────────────────────────────────────────────────
 *
 * ملاحظة الفريق (٢٤ أكتوبر): «اضبط آلية تقييم للمدرب **بعد انتهاء
 * الباقة أو الخدمة** وليس خلال أو قبل».
 *
 * ── اللي كان موجود ──────────────────────────────────────────
 *
 * ⚠️ **التقييم كان متاح من مكان واحد بس: طلب الخدمة الإبداعية.**
 *    والحارس هناك سليم (`status <> 'completed'` بيترفض) — يعني
 *    شرط «بعد الانتهاء» متحقّق للخدمات من الأول.
 *
 * ⚠️ **والباقات مالهاش طريق تقييم خالص.** اللي حجز باقة وخلّص
 *    جلساته مايقدرش يقيّم مدربه — مافيش شاشة ولا دالة. وجدول
 *    `reviews` فيه عمود `booking_id` جاهز ومستنّي من يوم ما
 *    اتعمل، ومفيش حاجة بتكتب فيه.
 *
 *    والنتيجة في الأرقام: **صفر تقييم في القاعدة كلها**. وصفحة
 *    المدرب العامة بتقول «لا توجد تقييمات بعد» لكل مدرب — وده
 *    أسوأ من مفيش قسم تقييمات أصلًا.
 *
 * ── تعريف «انتهت» ──────────────────────────────────────────
 *
 * الباقة انتهت لما **كل** جلساتها تبقى خلصت (تمّت أو اتلغت)،
 * **و** يكون فيه جلسة واحدة تمّت على الأقل.
 *
 * ⚠️ **الشرط التاني مش زيادة.** باقة كل جلساتها اتلغت = الطالب
 *    ماشافش المدرب ولا مرة. تقييم من غير لقاء مش تقييم — وده
 *    أخطر حاجة في أي نظام تقييمات: رأي من غير تجربة.
 *
 * ⚠️ **وباقة لسه مافيهاش ولا جلسة مش «منتهية»** حتى لو القايمة
 *    فاضية — القايمة الفاضية معناها إن الإدارة لسه ما جدولتش،
 *    مش إن الباقة خلصت. (وده الفرق اللي الفحص `total === 0`
 *    بيقفله: من غيره، باقة اتدفعت من دقيقة بتبقى «جاهزة للتقييم».)
 */

export type ReviewableSession = { status: string };

export type BookingReviewState =
  | { can: true; completedCount: number }
  | { can: false; reason: 'no_sessions' | 'in_progress' | 'never_met' | 'already_reviewed' };

/** الجلسة خلصت (بأي نتيجة)؟ */
function isFinished(status: string): boolean {
  return status === 'completed' || status === 'cancelled';
}

/**
 * الباقة دي ينفع تتقيّم؟
 *
 * `alreadyReviewed` بييجي من القاعدة — الفهرس الفريد على
 * `booking_id` هو اللي بيمنع التكرار فعلًا، وده عشان الشاشة
 * ماتعرضش نموذجًا هيترفض.
 */
export function bookingReviewState(
  sessions: ReviewableSession[],
  alreadyReviewed = false,
): BookingReviewState {
  if (alreadyReviewed) return { can: false, reason: 'already_reviewed' };
  if (sessions.length === 0) return { can: false, reason: 'no_sessions' };
  if (!sessions.every((s) => isFinished(s.status))) {
    return { can: false, reason: 'in_progress' };
  }
  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  if (completedCount === 0) return { can: false, reason: 'never_met' };
  return { can: true, completedCount };
}

/** الرسالة اللي الطالب يشوفها لما التقييم لسه مش متاح. */
export const REVIEW_BLOCKED_MESSAGE: Record<
  Exclude<BookingReviewState, { can: true }>['reason'],
  string
> = {
  no_sessions: 'الجلسات لسه ما اتجدولتش — هتقدر تقيّم بعد ما تخلّص الباقة.',
  in_progress: 'لسه فيه جلسات جاية. التقييم بيفتح بعد آخر جلسة.',
  never_met: 'كل جلسات الباقة اتلغت، فمفيش تجربة تتقيّم. لو فيه مشكلة، كلّمنا من الدعم.',
  already_reviewed: 'قيّمت الباقة دي قبل كده — شكرًا.',
};
