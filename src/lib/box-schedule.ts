/**
 * مواعيد شحنات صندوق الرحلة (ملف 140).
 *
 * الشهر الأول بيبدأ يوم التفعيل (تأكيد الدفع)، وكل شهر بعده بشهر.
 * «المستحق» = موعده جه أو هييجي قبل آخر الشهر الحالي — ده اللي فريق
 * التجهيز محتاج يشوفه دلوقتي.
 */

export function shipmentDueDate(startsAt: string | Date, monthNumber: number): Date {
  const d = new Date(startsAt);
  const due = new Date(d);
  due.setUTCMonth(d.getUTCMonth() + Math.max(0, monthNumber - 1));
  // ٣١ يناير + شهر = ٣ مارس في JS — نرجّعه لآخر فبراير.
  if (due.getUTCDate() !== d.getUTCDate()) due.setUTCDate(0);
  return due;
}

/** آخر لحظة في الشهر الحالي (UTC) — حد «المستحق دلوقتي». */
export function endOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function isDueThisMonth(startsAt: string | Date, monthNumber: number, now: Date): boolean {
  return shipmentDueDate(startsAt, monthNumber).getTime() <= endOfMonth(now).getTime();
}

/** كام يوم قبل موعد الشحنة تتفتح مهمتها (الافتراضي ٧، من ١ لـ٦٠) — مرآة `box_shipment_lead_days`. */
export const BOX_LEAD_DAYS_DEFAULT = 7;
export const BOX_LEAD_DAYS_MIN = 1;
export const BOX_LEAD_DAYS_MAX = 60;

export function clampLeadDays(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^[0-9]{1,3}$/.test(v) ? Number(v) : NaN;
  if (!Number.isFinite(n)) return BOX_LEAD_DAYS_DEFAULT;
  return Math.min(BOX_LEAD_DAYS_MAX, Math.max(BOX_LEAD_DAYS_MIN, Math.trunc(n)));
}

/** هل مهمة الشحنة المفروض تكون مفتوحة دلوقتي؟ (مرآة شرط `box_shipment_task_sync`) */
export function shipmentTaskOpensAt(startsAt: string | Date, monthNumber: number, leadDays: number): Date {
  const due = shipmentDueDate(startsAt, monthNumber);
  return new Date(due.getTime() - clampLeadDays(leadDays) * 86_400_000);
}
