import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { rescheduleAllowed } from './reschedule-policy';

const NOW = new Date('2026-10-24T10:00:00Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe('rescheduleAllowed', () => {
  it('قبل الجلسة بيومين وأول مرة = مسموح، وفاضل مرة', () => {
    expect(rescheduleAllowed({ role: 'guardian', scheduledAt: inHours(48), usedInPackage: 1, now: NOW })).toEqual({
      ok: true,
      remaining: 1,
    });
  });

  it('⚠️ أقل من ٢٤ ساعة = لأ، حتى للمدرب', () => {
    for (const role of ['guardian', 'student', 'instructor'] as const) {
      const r = rescheduleAllowed({ role, scheduledAt: inHours(23.5), usedInPackage: 0, now: NOW });
      expect(r, role).toMatchObject({ ok: false, reason: 'too_late' });
    }
  });

  it('٢٤ ساعة بالظبط = مسموح', () => {
    expect(rescheduleAllowed({ role: 'student', scheduledAt: inHours(24), usedInPackage: 0, now: NOW }).ok).toBe(true);
  });

  it('المرة التالتة لولي الأمر = لأ', () => {
    expect(
      rescheduleAllowed({ role: 'guardian', scheduledAt: inHours(72), usedInPackage: 2, now: NOW }),
    ).toMatchObject({ ok: false, reason: 'limit_reached' });
  });

  it('المدرب مش محسوب عليه عدد', () => {
    expect(rescheduleAllowed({ role: 'instructor', scheduledAt: inHours(72), usedInPackage: 9, now: NOW })).toEqual({
      ok: true,
      remaining: null,
    });
  });

  it('تاريخ مش صالح = لأ (مايعدّيش بالغلط)', () => {
    expect(rescheduleAllowed({ role: 'guardian', scheduledAt: 'x', usedInPackage: 0, now: NOW }).ok).toBe(false);
  });
});

describe('الحارس على الخادم', () => {
  const src = readFileSync(new URL('../actions/session-change-requests.ts', import.meta.url), 'utf8');
  it('طلب التأجيل بيعدّي على نفس السياسة', () => {
    expect(src).toMatch(/rescheduleAllowed\(/);
  });
  it('المرفوض مابيتحسبش من المرتين', () => {
    expect(src).toMatch(/\.in\('status', \['pending', 'approved'\]\)/);
  });
});
