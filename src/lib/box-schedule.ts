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
