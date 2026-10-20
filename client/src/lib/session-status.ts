import type { SessionStatus } from '@/types';

/**
 * أسماء حالات الجلسة وألوانها — **في مكان واحد**.
 *
 * ── ليه الملف ده ────────────────────────────────────────────
 *
 * الخريطة دي كانت مكتوبة **ثلاث مرات** في الموقع: شاشة ولي الأمر،
 * وشاشة جلسات المدرب، وصفحة جلسات المدرب عند الإدارة. وكل نسخة
 * كانت ناقصة حاجة مختلفة:
 *
 *   • نسخة ولي الأمر كانت ناقصها `scheduled` — **وهي الافتراضي في
 *     القاعدة** — فولي الأمر كان بيشوف كلمة `scheduled` خام.
 *   • نسخة الإدارة كانت بتلوّن `confirmed` وبتعرض باقي الحالات
 *     كنص إنجليزي خام.
 *
 * ⚠️ **والخريطة الناقصة مش عطل شكلي.** بلاغ فريق العمل «الجلسة
 *    فضلت قادمة» كان جزء منه إن الشاشة مش بتفرّق بين «معادها محدَّد»
 *    و«معادها ما اتحدّدش» — وهما حالتان مختلفتان تمامًا إداريًّا.
 *
 * والنوع `Record<SessionStatus, …>` معناه إن **إضافة حالة جديدة
 * للنوع بتوقف البناء** لحد ما تتضاف هنا. القايمة عمرها ما تنقص تاني.
 */
export type SessionStatusView = {
  label: string;
  /** لون الشارة في شاشات العميل (Tailwind). */
  className: string;
  /** نوع الشارة في `StatusBadge` بلوحة الإدارة. */
  badge: 'success' | 'warning' | 'danger' | 'neutral';
};

export const SESSION_STATUS: Record<SessionStatus, SessionStatusView> = {
  scheduled: {
    label: 'موعدها محدَّد',
    className: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
    badge: 'success',
  },
  confirmed: {
    label: 'مؤكدة',
    className: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
    badge: 'success',
  },
  // ⚠️ `pending` على جلسة معناها إن موعدها ما اتولدش — حالة شاذة
  //    محتاجة تدخّل إدارة، مش انتظار عادي.
  pending: {
    label: 'بانتظار تحديد موعد',
    className: 'bg-amber-100 text-amber-900 border border-amber-200',
    badge: 'warning',
  },
  completed: {
    label: 'تمت',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    badge: 'neutral',
  },
  cancelled: {
    label: 'ملغاة',
    className: 'bg-rose-100 text-rose-800 border border-rose-200',
    badge: 'danger',
  },
};

/**
 * عرض الحالة، ومعاها فرع احتياطي للقيمة اللي مش في النوع.
 *
 * ⚠️ الفرع الاحتياطي **بيعرض القيمة الخام زي ما هي** بدل ما يخترع
 *    اسمًا. لو القاعدة فيها حالة إحنا مانعرفهاش، اللي بيشوف الشاشة
 *    لازم يشوف إن فيه حاجة غريبة — لا اسم مطمئن غلط.
 */
export function sessionStatusView(status: string): SessionStatusView {
  return (
    SESSION_STATUS[status as SessionStatus] ?? {
      label: status,
      className: 'bg-slate-100 text-slate-700 border border-slate-200',
      badge: 'warning',
    }
  );
}

/**
 * جلسة معادها فات ولا اتقفلت ولا اتلغت.
 *
 * ⚠️ **ده بند البلاغ بالحرف:** «فضلت قادمة في جدول الجلسات برغم إن
 *    أصلًا معادها فات». الجلسة دي محتاجة تدخّل: يا إما المدرب نسي
 *    التقرير، يا إما الحصة ما حصلتش.
 */
export function isSessionOverdue(session: {
  scheduledAt: string;
  status: string;
}): boolean {
  if (session.status === 'completed' || session.status === 'cancelled') return false;
  const at = new Date(session.scheduledAt).getTime();
  if (Number.isNaN(at)) return false;
  return at < Date.now();
}
