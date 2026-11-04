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

// ══ أسبوع الشحن والتفعيل (طلب تامر، ١ نوفمبر) ═════════════════
//
// مرآة `box_shipment_week_start` و`box_shipment_active` وحارس
// `box_shipments_guard_fn` (ترحيل 20261101140000). الحارس الحقيقي في
// القاعدة — ده عشان الشاشة تقفل الزرار وتقول السبب قبل الضغط.

const DAY = 86_400_000;

/** تاريخ اليوم بتوقيت القاهرة `YYYY-MM-DD`. */
export function cairoDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDays(ymd: string, n: number): string {
  const t = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) + n * DAY;
  return new Date(t).toISOString().slice(0, 10);
}

/** أسبوع الشحنة: من السبت للجمعة، اللي فيه موعدها (بتوقيت القاهرة). */
export function shipmentWeek(startsAt: string | Date, monthNumber: number): { start: string; end: string } {
  const due = cairoDate(shipmentDueDate(startsAt, monthNumber));
  const dow = new Date(`${due}T00:00:00Z`).getUTCDay(); // الأحد = 0 … السبت = 6
  const start = addDays(due, -((dow + 1) % 7));
  return { start, end: addDays(start, 6) };
}

export type ShipmentGate = {
  week: { start: string; end: string };
  /** هي الأولى، أو اللي قبلها طلعت، أو أسبوعها جه. */
  active: boolean;
  canPrepare: boolean;
  canShip: boolean;
  /** عدّى أسبوعها ولسه ماطلعتش. */
  late: boolean;
  /** سبب قفل الزرار، بالعربي — `null` لو مفيش. */
  reason: string | null;
};

type ShipLike = { monthNumber: number; status: 'pending' | 'preparing' | 'shipped' | 'delivered' };

export function shipmentGate(
  sub: { startsAt?: string | null; status: string },
  shipments: ShipLike[],
  ship: ShipLike,
  now = new Date(),
): ShipmentGate | null {
  if (!sub.startsAt) return null;
  const week = shipmentWeek(sub.startsAt, ship.monthNumber);
  const today = cairoDate(now);
  const prev = shipments.find((s) => s.monthNumber === ship.monthNumber - 1);
  const prevOut = !prev || prev.status === 'shipped' || prev.status === 'delivered';
  const active = ship.monthNumber === 1 || prevOut || today >= week.start;
  const open = ship.status === 'pending' || ship.status === 'preparing';
  const subActive = sub.status === 'active';
  const inWeek = today >= week.start;

  let reason: string | null = null;
  if (open) {
    if (!subActive) reason = 'الاشتراك مش نشط.';
    else if (!active) reason = `مقفولة لحد ما شحنة الشهر ${ship.monthNumber - 1} تطلع أو ييجي أسبوعها.`;
    else if (!inWeek) reason = 'التجهيز متاح — الشحن في أسبوعها بس.';
  }
  return {
    week,
    active,
    canPrepare: ship.status === 'pending' && subActive && active,
    canShip: open && subActive && active && inWeek,
    late: open && today > week.end,
    reason,
  };
}

/** «١٤ – ٢٠ نوفمبر» */
export function weekLabel(week: { start: string; end: string }): string {
  const fmt = (ymd: string, withMonth: boolean) =>
    new Date(`${ymd}T12:00:00Z`).toLocaleDateString('ar-EG', {
      timeZone: 'UTC',
      day: 'numeric',
      ...(withMonth ? { month: 'long' } : {}),
    });
  const sameMonth = week.start.slice(0, 7) === week.end.slice(0, 7);
  return `${fmt(week.start, !sameMonth)} – ${fmt(week.end, true)}`;
}
