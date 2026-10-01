/**
 * حسابات مبيعات الناشر — مكان واحد للوحة وصفحة الطلبات.
 *
 * ⚠️ **اللوحة كانت بتجمع كل البنود**: طلب لسه «بانتظار الدفع» أو ملغي
 *    كان بيتحسب في «أرباحك». دلوقتي الأرباح من الطلبات اللي اتدفعت بس.
 * ⚠️ والنصيب من **اللي اتثبّت وقت الشراء** (ملف 134) قبل نصيب المنتج
 *    الحالي — وإلا الناشر يشوف رقم غير اللي هيتحاسب عليه.
 */

/** حالات اتدفع فيها الطلب فعلًا (من «تم الدفع» لـ«تم التسليم»). */
export const PAID_STATUSES = ['paid', 'preparing', 'shipped', 'delivered'] as const;

export function isPaidStatus(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

/**
 * نصيب الناشر من الوحدة.
 *   ١) المتثبّت وقت الشراء (`publisher_cost_snapshot`)
 *   ٢) نصيب المنتج الحالي (منتجات قبل ملف 134)
 *   ٣) بالعكس من السعر (منتجات قبل ملف 97) — ومايقلّش عن صفر
 */
export function sharePerUnit(params: {
  snapshot: number | null | undefined;
  currentCost: number | null | undefined;
  unitPrice: number;
  fixedAdminFee: number;
  multiplier: number;
}): number {
  if (params.snapshot != null && params.snapshot > 0) return params.snapshot;
  if (params.currentCost != null && params.currentCost > 0) return params.currentCost;
  const m = params.multiplier > 0 ? params.multiplier : 1;
  return Math.max(0, (params.unitPrice - params.fixedAdminFee) / m);
}

export function salesTotals(rows: { status: string; totalAmount: number; publisherShare: number }[]) {
  const paid = rows.filter((r) => isPaidStatus(r.status));
  return {
    paidCount: paid.length,
    sales: paid.reduce((s, r) => s + r.totalAmount, 0),
    earnings: paid.reduce((s, r) => s + r.publisherShare, 0),
    awaitingCount: rows.filter((r) => r.status === 'pending' || r.status === 'awaiting_verification').length,
  };
}
