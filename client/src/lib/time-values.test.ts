import { describe, expect, it } from 'vitest';
import { ageAtTime, dateKey, groupSessionsAt, isTodayAt } from './time-values';
describe('explicit client date inputs', () => {
  const now = Date.parse('2026-10-08T22:30:00Z');
  it('uses Cairo calendar days regardless of browser timezone', () => {
    expect(dateKey(now)).toBe('2026-10-09');
    expect(isTodayAt('2026-10-09T08:00:00Z', now)).toBe(true);
    expect(isTodayAt('2026-10-08T12:00:00Z', now)).toBe(false);
  });
  it('calculates birthdays from the clock input', () => {
    expect(ageAtTime('2016-10-09', now)).toBe(10);
    expect(ageAtTime('2016-10-10', now)).toBe(9);
    expect(ageAtTime('invalid', now)).toBeNull();
  });
  it('moves a session between groups exactly once when time passes', () => {
    const rows = [{ id: 'boundary', scheduledAt: new Date(now).toISOString() }];
    expect(groupSessionsAt(rows, now).upcoming).toHaveLength(1);
    expect(groupSessionsAt(rows, now + 1).upcoming).toHaveLength(0);
    expect(groupSessionsAt(rows, now + 1).past).toHaveLength(1);
  });
});
