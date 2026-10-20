import { describe, it, expect } from 'vitest';
import { shipmentDueDate, isDueThisMonth, clampLeadDays, shipmentTaskOpensAt } from './box-schedule';

describe('box-schedule', () => {
  it('الشهر الأول يوم التفعيل، وكل شهر بعده بشهر', () => {
    expect(shipmentDueDate('2026-10-05T10:00:00Z', 1).toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(shipmentDueDate('2026-10-05T10:00:00Z', 3).toISOString().slice(0, 10)).toBe('2026-12-05');
  });
  it('٣١ يناير + شهر = آخر فبراير مش ٣ مارس', () => {
    expect(shipmentDueDate('2027-01-31T10:00:00Z', 2).toISOString().slice(0, 10)).toBe('2027-02-28');
  });
  it('المستحق لحد آخر الشهر الحالي', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    expect(isDueThisMonth('2026-10-20T00:00:00Z', 2, now)).toBe(true); // 20 نوفمبر
    expect(isDueThisMonth('2026-10-20T00:00:00Z', 3, now)).toBe(false); // 20 ديسمبر
    expect(isDueThisMonth('2026-09-01T00:00:00Z', 1, now)).toBe(true); // متأخر
  });
});

describe('مهلة فتح مهمة الشحنة', () => {
  it('القيمة من ١ لـ٦٠ والافتراضي ٧', () => {
    expect(clampLeadDays(undefined)).toBe(7);
    expect(clampLeadDays('abc')).toBe(7);
    expect(clampLeadDays(0)).toBe(1);
    expect(clampLeadDays(999)).toBe(60);
    expect(clampLeadDays('14')).toBe(14);
    expect(clampLeadDays(10.9)).toBe(10);
  });
  it('المهمة بتتفتح قبل الموعد بعدد الأيام', () => {
    const opens = shipmentTaskOpensAt('2026-10-05T10:00:00Z', 3, 7); // الموعد 5 ديسمبر
    expect(opens.toISOString().slice(0, 10)).toBe('2026-11-28');
  });
});
