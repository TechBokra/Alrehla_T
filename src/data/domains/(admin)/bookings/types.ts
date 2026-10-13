

/** حجز كتابة كما تراه الإدارة. */
export type AdminCourseBooking = {
  id: string;
  participantName: string;
  packageName: string;
  amount: number | null;
  status: string;
  paymentReference: string | null;
  paymentMethod: string | null;
  paymentReceiptUrl: string | null;
  preferredInstructorId: string | null;
  preferredInstructorName: string | null;
  createdAt: string;
  startedAt: string | null;
  sessionsCount: number;
  /** إهداء خاص كتبه صاحب الحجز — بيتقفل بعد الإنشاء. */
  giftMessage: string | null;
  /**
   * وقت موافقة ولي الأمر على تسجيل الجلسات.
   *
   * ⚠️ فاضي معناه حاجة من اتنين: **حجز قديم** قبل ما الميزة تشتغل،
   *    أو **الكتابة فشلت** — والتانية دي بتوصل للإدارة كإشعار وقتها.
   *    الشاشة بتفرّق بينهم بتاريخ الحجز.
   */
  recordingConsentAt: string | null;
};
