import { describe, it, expect } from 'vitest';
import {
  SERVICE_DUE_DAYS,
  isOverdue,
  daysUntilDue,
  dueLabel,
} from './service-delivery';

const NOW = new Date('2026-09-15T12:00:00Z');
const inDays = (n: number) =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe('مهلة التسليم', () => {
  it('المهلة الطبيعية 14 يومًا', () => {
    expect(SERVICE_DUE_DAYS).toBe(14);
  });

  // طلب من غير مهلة (قبل تأكيد الدفع) ما ينفعش يتحسب متأخر.
  it('طلب بلا مهلة ليس متأخرًا', () => {
    expect(isOverdue(null, NOW)).toBe(false);
    expect(isOverdue(undefined, NOW)).toBe(false);
    expect(daysUntilDue(null, NOW)).toBeNull();
    expect(dueLabel(null, NOW)).toBe('بدون مهلة محددة');
  });

  it('يميّز المتأخر عن اللي لسه في مهلته', () => {
    expect(isOverdue(inDays(-1), NOW)).toBe(true);
    expect(isOverdue(inDays(1), NOW)).toBe(false);
  });

  it('يحسب الأيام المتبقية والمتأخرة', () => {
    expect(daysUntilDue(inDays(3), NOW)).toBe(3);
    expect(daysUntilDue(inDays(-2), NOW)).toBe(-2);
  });

  it('يكتب الجملة المعروضة صح', () => {
    expect(dueLabel(inDays(5), NOW)).toBe('باقي 5 يوم');
    expect(dueLabel(inDays(-4), NOW)).toBe('متأخر 4 يوم');
    expect(dueLabel(NOW.toISOString(), NOW)).toBe('المهلة تنتهي اليوم');
  });
});
