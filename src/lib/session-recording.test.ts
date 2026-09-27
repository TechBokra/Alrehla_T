import { describe, it, expect } from 'vitest';
import {
  retentionLabel,
  recordingNotice,
  consentLabel,
  RETENTION_OPTIONS,
  DEFAULT_RETENTION_DAYS,
} from './session-recording';

/**
 * ⚠️ الاختبارات دي بتحرس **وعدًا لولي أمر عن تسجيل فيه ابنه**، مش
 *    نصًّا في شاشة. أي شاشة تقول مدة غير اللي في الإعدادات = وعد
 *    مكسور.
 */
describe('مدة الاحتفاظ', () => {
  it('الخيارات المعروفة بتتكتب بالعربي', () => {
    expect(retentionLabel(7)).toBe('أسبوع');
    expect(retentionLabel(30)).toBe('شهر');
    expect(retentionLabel(90)).toBe('ثلاثة شهور');
  });

  it('⚠️ رقم مش في القايمة بيتعرض بالأيام لا بيتقرّب لأقرب خيار', () => {
    // ١٤ يومًا **مش** «أسبوع». التقريب هنا بيخلّي الشاشة تكدب.
    expect(retentionLabel(14)).toBe('14 يومًا');
    expect(retentionLabel(1)).toBe('يوم واحد');
    expect(retentionLabel(3)).toBe('3 أيام');
  });

  it('كل خيار للإدارة له اسم مختلف', () => {
    const labels = RETENTION_OPTIONS.map((o) => retentionLabel(o.days));
    expect(new Set(labels).size).toBe(RETENTION_OPTIONS.length);
  });
});

describe('نصوص الإفصاح', () => {
  it('المدة بتظهر في التنبيه وفي جملة الموافقة', () => {
    expect(recordingNotice(7)).toContain('أسبوع');
    expect(consentLabel(7)).toContain('أسبوع');
    expect(recordingNotice(30)).toContain('شهر');
  });

  it('التنبيه بيقول ليه بيتسجّل ومين بيشوفه', () => {
    const text = recordingNotice(DEFAULT_RETENTION_DAYS);
    expect(text).toContain('الأمان');
    expect(text).toContain('بتتحذف');
    expect(text).toContain('مابيتنشرش');
  });

  it('⚠️ جملة الموافقة صيغتها موافقة صريحة لا إخطار', () => {
    expect(consentLabel(30).startsWith('أوافق')).toBe(true);
  });
});
