import { describe, it, expect } from 'vitest';
import { SESSION_STATUS, sessionStatusView, isSessionOverdue } from './session-status';

/**
 * ⚠️ الاختبارات دي بتحرس بندين من بلاغ فريق العمل:
 *
 *   «فضلت (قادمة) في جدول الجلسات برغم أن أصلًا معادها فات»
 *   وعرض الحالة الخام (`scheduled`) لولي الأمر.
 */
describe('خريطة الحالات', () => {
  it('فيها `scheduled` — وهي افتراضي القاعدة', () => {
    expect(SESSION_STATUS.scheduled.label).toBe('موعدها محدَّد');
  });

  it('كل حالة ليها اسم عربي وشارة', () => {
    for (const [key, view] of Object.entries(SESSION_STATUS)) {
      expect(view.label, key).not.toBe(key);
      expect(view.badge, key).toBeTruthy();
    }
  });

  it('⚠️ الحالة المجهولة بتتعرض خام لا باسم مطمئن', () => {
    const view = sessionStatusView('something_new');
    expect(view.label).toBe('something_new');
    expect(view.badge).toBe('warning');
  });
});

describe('الجلسة المتأخرة', () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();

  it('معادها فات وما اتقفلتش = متأخرة', () => {
    expect(isSessionOverdue({ scheduledAt: past, status: 'scheduled' })).toBe(true);
    expect(isSessionOverdue({ scheduledAt: past, status: 'pending' })).toBe(true);
  });

  it('المقفولة والملغاة مش متأخرة', () => {
    expect(isSessionOverdue({ scheduledAt: past, status: 'completed' })).toBe(false);
    expect(isSessionOverdue({ scheduledAt: past, status: 'cancelled' })).toBe(false);
  });

  it('القادمة مش متأخرة', () => {
    expect(isSessionOverdue({ scheduledAt: future, status: 'scheduled' })).toBe(false);
  });

  it('⚠️ التاريخ الغلط مش متأخر — مش لازم يملّي الشاشة تحذيرات كاذبة', () => {
    expect(isSessionOverdue({ scheduledAt: 'not a date', status: 'scheduled' })).toBe(false);
  });
});
