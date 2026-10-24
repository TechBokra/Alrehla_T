import { describe, expect, it } from 'vitest';
import {
  USAGE_STATUS_TEXT,
  daysInUtcMonth,
  usageForecast,
} from './daily-usage';
import { monthBounds } from './daily';

const at = (iso: string) => new Date(iso);
const f = (used: number, iso: string) =>
  usageForecast({
    used,
    limit: 10_000,
    now: at(iso),
    usdPerExtraMinute: 0.004,
  });

describe('usageForecast', () => {
  it('أيام الشهر صح، وفبراير الكبيسة', () => {
    expect(daysInUtcMonth(at('2026-10-24T10:00:00Z'))).toBe(31);
    expect(daysInUtcMonth(at('2028-02-10T10:00:00Z'))).toBe(29);
  });

  it('استهلاك قليل = في الأمان، والباقي مضبوط', () => {
    const r = f(2_000, '2026-10-20T12:00:00Z');
    expect(r.remaining).toBe(8_000);
    expect(r.dailyAverage).toBe(100);
    expect(r.projected).toBe(3_100);
    expect(r.limitHitDay).toBeNull();
    expect(r.status).toBe('safe');
    expect(r.daysLeft).toBe(11);
  });

  it('بالمعدّل ده هنعدّي = يوم الوصول للحد والتكلفة الزيادة', () => {
    // ٥٠٠ دقيقة في اليوم × ٣١ = ١٥٥٠٠ → زيادة ٥٥٠٠ × ٠٫٠٠٤ = ٢٢ دولار
    const r = f(5_000, '2026-10-10T08:00:00Z');
    expect(r.limitHitDay).toBe(20);
    expect(r.daysOfRunway).toBe(10);
    expect(r.projectedExtraMinutes).toBe(5_500);
    expect(r.projectedExtraUsd).toBe(22);
    expect(r.status).toBe('over_soon');
  });

  it('عدّينا فعلًا = الباقي صفر والنسبة الحقيقية محفوظة', () => {
    const r = f(12_000, '2026-10-24T08:00:00Z');
    expect(r.remaining).toBe(0);
    expect(r.percent).toBe(100);
    expect(r.rawPercent).toBe(120);
    expect(r.status).toBe('over');
  });

  it('أول يوم في الشهر من غير استهلاك مايقسمش على صفر', () => {
    const r = f(0, '2026-11-01T00:30:00Z');
    expect(r.daysElapsed).toBe(1);
    expect(r.daysOfRunway).toBeNull();
    expect(r.status).toBe('safe');
  });

  it('كل حالة ليها جملة عربية', () => {
    for (const msg of Object.values(USAGE_STATUS_TEXT)) {
      // اسم الخدمة نفسه مسموح.
      expect(msg.replace('Daily', '')).not.toMatch(/[A-Za-z]{4}/);
    }
  });
});

describe('monthBounds', () => {
  it('الشهر الحالي واللي قبله بتوقيت UTC', () => {
    const now = at('2026-01-15T10:00:00Z');
    expect(monthBounds(now, 0)).toEqual({
      start: Date.UTC(2026, 0, 1) / 1000,
      end: Date.UTC(2026, 1, 1) / 1000,
    });
    // ⚠️ يناير − ١ = ديسمبر السنة اللي فاتت
    expect(monthBounds(now, -1).start).toBe(Date.UTC(2025, 11, 1) / 1000);
  });
});
