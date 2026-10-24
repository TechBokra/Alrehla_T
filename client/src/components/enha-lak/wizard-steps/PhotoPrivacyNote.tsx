import { Lock } from 'lucide-react';
import { retentionLabel } from '@/lib/session-recording';

/**
 * جملة الخصوصية جنب رفع صورة الطفل.
 *
 * دراسة المنافسين (١٧ أكتوبر): «الخصوصية تُقال بجملة واحدة قرب زر
 * الرفع، لا في صفحة سياسة وحدها».
 *
 * ⚠️ **الوعد ده متنفّذ فعلًا** — مهمة `child-photos` اليومية بتمسح
 *    الصور بعد المدة اللي في الإعدادات (اللوحة ← المحتوى ← الإعدادات).
 *    والمدة بتيجي من نفس الإعداد، فالجملة مابتختلفش عن اللي بيحصل.
 *    من غير المدة (`days` فاضي) الجملة مابتظهرش — مانكتبش رقم مش متأكدين منه.
 */
export function PhotoPrivacyNote({ days }: { days?: number }) {
  if (!days) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-relaxed text-slate-600">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
      <span>
        الصورة بيشوفها فريق التنفيذ بس، وبتتحذف تلقائيًا بعد {retentionLabel(days)} من انتهاء الطلب.
      </span>
    </p>
  );
}
