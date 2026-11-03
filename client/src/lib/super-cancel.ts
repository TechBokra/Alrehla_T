/**
 * إلغاء طلب مدفوع (أو بعد الدفع) — للمدير العام بس (طلب تامر، ١ نوفمبر).
 * نفس القاعدة في القاعدة (ترحيل 20261101160000) — ده للشاشة والأكشن.
 */
export const SUPER_CANCEL_ONLY = 'إلغاء طلب مدفوع متاح للمدير العام بس.';

/** حالات «الفلوس وصلت» في كل نوع طلب. */
export const PAID_ORDER_STATUSES = [
  'paid',
  'preparing',
  'shipped',
  'delivered',
] as const;
export const PAID_SERVICE_STATUSES = [
  'paid',
  'in_progress',
  'delivered',
  'completed',
] as const;

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'super_admin';
}

/** ملاحظة بتتعرض جنب الإلغاء: الإلغاء مابيرجّعش الفلوس لوحده. */
export const REFUND_NOTE =
  'الإلغاء مابيرجّعش الفلوس لوحده — الاسترداد من لوحة XPay (أو تحويل يدوي)، واكتبه في السبب.';
