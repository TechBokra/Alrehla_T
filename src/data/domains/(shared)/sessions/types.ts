

/**
 * طلبات تغيير موعد الجلسات (ملف 16 — #LQMO).
 *
 * ⚠️ قبل ما ملف 16 يتشغّل الجدول مش موجود — الدوال بترجع فاضي بدل خطأ،
 *    فالصفحات بتفتح عادي ومن غير الزرار.
 */
export type SessionChangeRow = {
  id: string;
  sessionId: string;
  requesterRole: 'guardian' | 'instructor' | 'student';
  requesterName: string;
  proposedAt: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  adminNote: string | null;
  createdAt: string;
  sessionAt: string | null;
  sessionNumber: number | null;
};
