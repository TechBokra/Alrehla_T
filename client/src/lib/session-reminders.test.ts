import { describe, it, expect } from 'vitest';
import { cairoTodayRange, remindersFor } from '@/lib/session-reminders';

describe('تذكير يوم الجلسة', () => {
  it('«النهارده» بتوقيت القاهرة مش UTC', () => {
    // ١١ مساءً UTC يوم ٩ = ١ أو ٢ صباحًا القاهرة يوم ١٠
    const { start, end } = cairoTodayRange(new Date('2026-10-09T23:00:00Z'));
    expect(start.toISOString() < '2026-10-09T23:00:00.000Z').toBe(true);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(start.toISOString().startsWith('2026-10-09T2')).toBe(true);
  });

  const base = {
    id: 's1', scheduledAt: '2026-10-10T14:00:00Z', sessionNumber: 3, packageName: 'رحلة الكلمات',
    bookerId: 'parent', childId: null, childName: null, childAccountId: null, instructorUserId: 'teacher',
  };

  it('طالب بيحجز لنفسه + المدرب', () => {
    const rows = remindersFor(base);
    expect(rows.map((r) => r.recipient_profile_id)).toEqual(['parent', 'teacher']);
    expect(rows[0].link).toBe('/dashboard/student/sessions/s1');
    expect(rows[1].link).toBe('/dashboard/instructor/sessions/s1');
  });

  it('ولي أمر + حساب الطفل + المدرب، وولي الأمر بيروح لصفحة متابعة الطفل', () => {
    const rows = remindersFor({ ...base, childId: 'c1', childName: 'ميار', childAccountId: 'kid' });
    expect(rows.map((r) => r.recipient_profile_id)).toEqual(['parent', 'kid', 'teacher']);
    expect(rows[0].link).toBe('/account/family/c1');
    expect(rows[0].title).toContain('ميار');
  });
});
