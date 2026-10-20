import { describe, it, expect } from 'vitest';
import { ageBandOf, ageGroupOf, ageOn, parseBirthDate } from './age';

// ظهر يوم ١٥ أكتوبر ٢٠٢٦ بتوقيت القاهرة (UTC+3 صيفي أو +2 شتوي — الظهر آمن).
const NOW = new Date('2026-10-15T09:00:00Z');

describe('ageOn', () => {
  it('يوم الميلاد نفسه بيزوّد سنة', () => {
    expect(ageOn('2014-10-15', NOW)).toBe(12);
  });

  it('يوم قبل عيد الميلاد لسه سنة أقل', () => {
    expect(ageOn('2014-10-16', NOW)).toBe(11);
  });

  it('أول السنة وآخرها', () => {
    expect(ageOn('2014-01-01', NOW)).toBe(12);
    expect(ageOn('2014-12-31', NOW)).toBe(11);
  });

  it('٢٩ فبراير سنة كبيسة', () => {
    expect(ageOn('2012-02-29', NOW)).toBe(14);
  });

  it('تاريخ مش حقيقي = null', () => {
    expect(ageOn('2015-02-30', NOW)).toBeNull();
    expect(ageOn('2015-13-01', NOW)).toBeNull();
    expect(ageOn('كلام', NOW)).toBeNull();
    expect(ageOn('15/10/2014', NOW)).toBeNull();
  });
});

describe('parseBirthDate', () => {
  it('١٢ فأكبر بيعدّي', () => {
    const r = parseBirthDate('2010-03-25', NOW);
    expect(r).toEqual({ ok: true, iso: '2010-03-25', age: 16 });
  });

  it('أرقام عربية هندية', () => {
    const r = parseBirthDate('٢٠١٠-٠٣-٢٥', NOW);
    expect(r.ok).toBe(true);
  });

  it('أقل من ١٢ بيترفض من الحساب المستقل', () => {
    const r = parseBirthDate('2016-01-01', NOW);
    expect(r.ok).toBe(false);
  });

  it('مستقبل وفاضي وكلام', () => {
    expect(parseBirthDate('2030-01-01', NOW).ok).toBe(false);
    expect(parseBirthDate('', NOW).ok).toBe(false);
    expect(parseBirthDate(undefined, NOW).ok).toBe(false);
    expect(parseBirthDate('أمس', NOW).ok).toBe(false);
  });

  it('عمر مش منطقي', () => {
    expect(parseBirthDate('1800-01-01', NOW).ok).toBe(false);
  });
});

describe('الفئة', () => {
  it('مجهول = أقل من ١٢', () => {
    expect(ageGroupOf(null)).toBe('under_12');
  });

  it('حد ١٢', () => {
    expect(ageGroupOf(11)).toBe('under_12');
    expect(ageGroupOf(12)).toBe('12_plus');
    expect(ageGroupOf(40)).toBe('12_plus');
  });

  it('فئة العرض بتتبع تقسيم «إنها لك»', () => {
    expect(ageBandOf(6)).toBe('6-9');
    expect(ageBandOf(9)).toBe('6-9');
    expect(ageBandOf(10)).toBe('10-12');
    expect(ageBandOf(12)).toBe('10-12');
    expect(ageBandOf(13)).toBe('13-17');
    expect(ageBandOf(17)).toBe('13-17');
    expect(ageBandOf(18)).toBe('18-20');
    expect(ageBandOf(20)).toBe('18-20');
  });

  it('خارج المدى = null', () => {
    expect(ageBandOf(5)).toBeNull();
    expect(ageBandOf(21)).toBeNull();
    expect(ageBandOf(null)).toBeNull();
  });
});
