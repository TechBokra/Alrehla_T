/**
 * أكواد الخصم (ملف 13) — الثوابت والحسابات اللي الشاشة والخادم بيشتركوا فيها.
 *
 * ⚠️ **الخصم الحقيقي بيتحسب في القاعدة** وقت الطلب. اللي هنا للعرض بس،
 *    وبنفس قاعدة القاعدة بالظبط (النسبة على المنتجات، مش الشحن، ولأقرب
 *    جنيه) — عشان الرقم اللي العميل بيشوفه هو اللي بيتطلب منه.
 */

export type DiscountLine = 'enha_lak' | 'box' | 'courses' | 'services';

export const DISCOUNT_LINES: DiscountLine[] = ['enha_lak', 'box', 'courses', 'services'];

export const DISCOUNT_LINE_LABELS: Record<DiscountLine, string> = {
  enha_lak: '«إنها لك»',
  box: 'صندوق الرحلة',
  courses: 'باقات «بداية الرحلة»',
  services: 'الخدمات الإبداعية',
};

export function isDiscountLine(v: unknown): v is DiscountLine {
  return typeof v === 'string' && (DISCOUNT_LINES as string[]).includes(v);
}

/** نفس قيد القاعدة: حروف إنجليزي كبيرة وأرقام و- و_، من ٣ لـ٣٠. */
export function normalizeDiscountCode(v: string): string {
  return v.trim().toUpperCase();
}

export function isValidDiscountCode(v: string): boolean {
  return /^[A-Z0-9_-]{3,30}$/.test(normalizeDiscountCode(v));
}

/** مبلغ الخصم على أساس — لأقرب جنيه زي `round()` في القاعدة. */
export function discountAmount(base: number, percent: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const p = Math.min(90, Math.max(0, Math.trunc(percent) || 0));
  return Math.round((base * p) / 100);
}

/** «كل المنصة» أو أسماء الأقسام. */
export function linesSummary(lines: string[] | null | undefined): string {
  if (!lines || lines.length === 0) return 'كل المنصة';
  return lines.map((l) => (isDiscountLine(l) ? DISCOUNT_LINE_LABELS[l] : l)).join(' · ');
}
