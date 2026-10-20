import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Info, Circle } from 'lucide-react';

/**
 * شارة الحالة — **المكوّن المشترك لكل اللوحات (٤١ شاشة)**.
 *
 * ── إيه اللي اتغيّر، وليه ───────────────────────────────────
 *
 * **① بقى يستهلك الرموز الدلالية.** كان مكتوبًا بألوان صريحة
 *    (`bg-green-100 text-green-700`)، والرموز موجودة في
 *    `globals.css` من المرحلة صفر **ومستعملة صفر مرة**. دلوقتي
 *    تغيير لون «تمام» في المشروع كله = سطر في ملف الرموز.
 *
 * **② واتضافت حالة `pending`.** كانت ناقصة، والشاشات كانت
 *    بتخريط «في انتظار الدفع» على `warning`.
 *
 *    ⚠️ **وده مش تفصيلة لغوية.** التحذير معناه «فيه حاجة غلط،
 *       بُصّ»، والانتظار معناه «كله تمام، استنى». لما الاتنين
 *       بلون واحد، الإداري بيتعلّم يتجاهل البرتقالي — وساعتها
 *       بيتجاهل التحذير الحقيقي لما ييجي.
 *
 * **③ وبقى فيه أيقونة لكل حالة.**
 *
 *    ⚠️ **اللون وحده مش معلومة.** اللي عنده عمى ألوان (حوالي
 *       واحد من كل اثني عشر راجل) بيشوف الأخضر والأحمر لونًا
 *       واحدًا — يعني «تمّ» و«مرفوض» شكلهم واحد. والمعيار بيقول
 *       صراحةً إن اللون مايبقاش الوسيلة الوحيدة لنقل المعنى.
 *
 *       والنصّ كان موجود، بس الأيقونة بتخلّي الحالة تتقري من
 *       **بعيد** بلا قراءة — وده اللي بيتعمل في جدول فيه خمسين
 *       صفًّا.
 *
 * **④ والتباين اتقاس مش اتقدّر.**
 *
 *    حسبت النسب من قيم Tailwind الحقيقية في الـCSS المولَّد
 *    (oklch مش hex بتاع v3):
 *
 *        green-700 على green-100  = 4.50  ← على الحدّ بالظبط
 *        red-600   على red-50     = 4.36  🔴 راسب
 *        slate-500 على slate-100  = 4.35  🔴 راسب
 *
 *    ⚠️ والاتنين الأخيرين **كانوا رموزًا دلالية** — يعني الرمز
 *       نفسه كان بيوقّع في المعيار. اتصلّحوا في `globals.css`
 *       (`red-700` = 5.88 · `slate-600` = 6.90).
 *
 *    و«تمام» اتنقل لـ`emerald-800` على `emerald-50` = **7.19**
 *    بدل ما يفضل واقفًا على 4.50 بالظبط — الرقم اللي على الحدّ
 *    بيسقط مع أول تغيير في نسخة Tailwind.
 */

export type StatusBadgeType =
  | 'success'
  | 'warning'
  | 'danger'
  | 'pending'
  | 'info'
  | 'neutral';

const STYLES: Record<StatusBadgeType, { cls: string; Icon: typeof Circle }> = {
  // `emerald-800` بدل `success` (700): النجاح أكتر حالة بتتكرّر في
  // الجداول، ومستحقّ يبقى الأوضح.
  success: { cls: 'bg-success-soft text-emerald-800', Icon: CheckCircle2 },
  warning: { cls: 'bg-warning-soft text-warning', Icon: AlertTriangle },
  danger: { cls: 'bg-danger-soft text-danger', Icon: XCircle },
  pending: { cls: 'bg-pending-soft text-pending', Icon: Clock },
  info: { cls: 'bg-info-soft text-info', Icon: Info },
  neutral: { cls: 'bg-slate-100 text-slate-700', Icon: Circle },
};

interface StatusBadgeProps {
  label: React.ReactNode;
  type: StatusBadgeType;
  /**
   * إخفاء الأيقونة.
   *
   * ⚠️ **مايتستخدمش في جدول.** موجودة للمساحات الضيّقة جدًّا،
   *    ومعاها الحالة بترجع تعتمد على اللون والنصّ وحدهم.
   */
  hideIcon?: boolean;
}

export function StatusBadge({ label, type, hideIcon = false }: StatusBadgeProps) {
  const { cls, Icon } = STYLES[type] ?? STYLES.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-center text-xs font-bold whitespace-nowrap ${cls}`}
    >
      {/* `aria-hidden` لأن النصّ جنبها بيقول نفس المعنى — من غيرها
          قارئ الشاشة بيقرا الحالة مرتين. */}
      {!hideIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {label}
    </span>
  );
}
