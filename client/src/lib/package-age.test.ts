import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ageInYears, childAgeGroup, childFitsPackage } from './package-age';

// ١٥ أكتوبر ٢٠٢٦، الضهر بتوقيت القاهرة
const NOW = new Date('2026-10-15T09:00:00Z');
const kid = (
  birthDate: string | null,
  ageGroupOverride: '12_plus' | 'under_12' | null = null
) => ({
  name: 'سلمى',
  birthDate,
  ageGroupOverride,
});

describe('السن والفئة', () => {
  it('السن بالسنين الكاملة — قبل عيد الميلاد بيوم = لسه أصغر', () => {
    expect(ageInYears('2014-10-15', NOW)).toBe(12);
    expect(ageInYears('2014-10-16', NOW)).toBe(11);
  });

  /** ⚠️ ١٢ بالظبط = «١٢ فأكثر» — نفس `child_age_group` في القاعدة. */
  it('يوم عيد ميلاده الـ١٢ بيدخل ١٢ فأكثر', () => {
    expect(childAgeGroup(kid('2014-10-15'), NOW)).toBe('12_plus');
    expect(childAgeGroup(kid('2014-10-16'), NOW)).toBe('under_12');
  });

  it('استثناء الإدارة بيغلب تاريخ الميلاد', () => {
    expect(childAgeGroup(kid('2018-01-01', '12_plus'), NOW)).toBe('12_plus');
    expect(childAgeGroup(kid(null, 'under_12'), NOW)).toBe('under_12');
  });

  it('مفيش تاريخ ميلاد = مش معروف', () => {
    expect(childAgeGroup(kid(null), NOW)).toBeNull();
  });
});

describe('childFitsPackage', () => {
  it('الطفل الصغير في باقة الصغار = تمام', () => {
    expect(childFitsPackage(kid('2018-05-01'), 'under_12', NOW)).toEqual({
      ok: true,
    });
  });

  it('الطفل الصغير في باقة الكبار = لأ، وبالسبب', () => {
    const r = childFitsPackage(kid('2018-05-01'), '12_plus', NOW);
    expect(r).toMatchObject({ ok: false, reason: 'too_young' });
  });

  it('الكبير في باقة الصغار = لأ', () => {
    expect(childFitsPackage(kid('2010-05-01'), 'under_12', NOW)).toMatchObject({
      ok: false,
      reason: 'too_old',
    });
  });

  it('مفيش تاريخ ميلاد = بيطلب يسجّله', () => {
    const r = childFitsPackage(kid(null), 'under_12', NOW);
    expect(r).toMatchObject({ ok: false, reason: 'no_birth_date' });
  });
});

/** الحارس الحقيقي في القاعدة — لو اتشال، الشاشة بس هي اللي بتمنع. */
describe('حارس القاعدة', () => {
  const sql = readFileSync(
    new URL(
      '../../supabase/migrations/20261024090000_package_booking_rules.sql',
      import.meta.url
    ),
    'utf8'
  );

  it('بيقفل الحجز على الباقة المقفولة وعلى السن الغلط', () => {
    expect(sql).toMatch(/before insert on public\.course_subscriptions/);
    expect(sql).toMatch(/v_pkg\.booking_open is false/);
    expect(sql).toMatch(/v_group <> v_pkg\.age_group/);
  });

  it('١٢ بالظبط = ١٢ فأكثر في القاعدة كمان', () => {
    expect(sql).toMatch(/< 12\s+then 'under_12'/);
  });

  it('ولي الأمر مايقدرش يحط الاستثناء لنفسه', () => {
    expect(sql).toMatch(/الاستثناء ده من الإدارة بس/);
  });
});
