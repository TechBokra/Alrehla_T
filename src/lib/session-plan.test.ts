import { describe, it, expect } from 'vitest';
import {
  nextSessionNumber,
  sessionQuota,
  quotaNotice,
  checkScheduleTime,
  parseCairoInput,
  MIN_LEAD_MINUTES,
} from './session-plan';

const MIN = 60 * 1000;

describe('رقم الجلسة الجاية', () => {
  it('أول جلسة رقمها واحد', () => {
    expect(nextSessionNumber([])).toBe(1);
  });

  it('⚠️ أكبر رقم + واحد، مش العدد + واحد', () => {
    // اشتراك اتلغت منه جلسة ٣: العدّ بيقول ٤ وهو **متاخد**، والقيد
    // في القاعدة بيرفض الإدراج (أو الأوحش: يعدّي ويبقى فيه رقمين).
    expect(nextSessionNumber([1, 2, 4])).toBe(5);
  });

  it('الترتيب مش مهم', () => {
    expect(nextSessionNumber([4, 1, 2])).toBe(5);
  });

  it('الأرقام الغلط بتتشال قبل الحساب', () => {
    expect(nextSessionNumber([0, -3, Number.NaN, 2])).toBe(3);
    expect(nextSessionNumber([0, -3])).toBe(1);
  });
});

describe('الجلسة الزيادة', () => {
  it('جوّه الباقة', () => {
    const q = sessionQuota({ packageSessions: 12, scheduledCount: 5 });
    expect(q).toMatchObject({ contracted: 12, scheduled: 5, remaining: 7, isExtra: false });
  });

  it('⚠️ العدد خلص فالجاية زيادة', () => {
    const q = sessionQuota({ packageSessions: 12, scheduledCount: 12 });
    expect(q.isExtra).toBe(true);
    expect(q.remaining).toBe(0);
    expect(quotaNotice(q)).toContain('زيادة عن المتعاقَد عليه');
  });

  it('⚠️ الباقة بلا عدد مابتبقاش صفر', () => {
    // الصفر كان هيخلّي **كل** جلسة تبان زيادة، فالتحذير يفقد معناه
    // من كتر التكرار — والتحذير اللي بيتكرر دايمًا بيتجاهَل دايمًا.
    const q = sessionQuota({ packageSessions: null, scheduledCount: 30 });
    expect(q.contracted).toBeNull();
    expect(q.isExtra).toBe(false);
    expect(quotaNotice(q)).toContain('مالهاش عدد جلسات محدّد');
  });

  it('صفر أو سالب في الباقة بيتعامل زيّ «بلا عدد»', () => {
    expect(sessionQuota({ packageSessions: 0, scheduledCount: 1 }).contracted).toBeNull();
    expect(sessionQuota({ packageSessions: -4, scheduledCount: 1 }).contracted).toBeNull();
  });

  it('الباقي مابينزلش تحت الصفر', () => {
    const q = sessionQuota({ packageSessions: 12, scheduledCount: 15 });
    expect(q.remaining).toBe(0);
    expect(q.isExtra).toBe(true);
  });
});

describe('قراءة الموعد كساعة حيطة في القاهرة', () => {
  it('⚠️ نفس النص بيدّي نفس اللحظة مهما كان توقيت الجهاز', () => {
    // الخانة بترجّع نصًّا بلا منطقة زمنية. `new Date()` كانت هتقراه
    // بتوقيت جهاز الإداري — فإداري برّه مصر بيسجّل جلسة بساعة غلط،
    // والشاشة بتعرض بتوقيت القاهرة فمحدّش بيلاحظ.
    const a = parseCairoInput('2026-10-05T17:00');
    expect(a).not.toBeNull();
    // ساعة الحيطة دي بتتحوّل للحظة واحدة ثابتة، والفرق بينها وبين
    // اللي بعدها بساعة = ساعة بالظبط.
    const b = parseCairoInput('2026-10-05T18:00');
    expect(b!.getTime() - a!.getTime()).toBe(60 * MIN);
  });

  it('النص الناقص أو الغلط بيرجّع null', () => {
    expect(parseCairoInput('')).toBeNull();
    expect(parseCairoInput('بكرة')).toBeNull();
    expect(parseCairoInput('2026-13-05T17:00')).toBeNull();
    expect(parseCairoInput('2026-10-05T25:00')).toBeNull();
  });
});

describe('فحص الموعد', () => {
  // ⚠️ المواعيد هنا متبنية من `parseCairoInput` نفسها عشان
  //    الاختبار ما يتعلّقش بالتوقيت الصيفي في مصر — اللي بيتغيّر
  //    بقرار إداري لا بقاعدة ثابتة.
  const slot = parseCairoInput('2026-10-05T17:00')!.getTime();

  it('موعد سليم بيعدّي', () => {
    expect(checkScheduleTime('2026-10-05T17:00', slot - 3 * 60 * MIN).ok).toBe(true);
  });

  it('الفاضي بيترفض برسالة', () => {
    expect(checkScheduleTime('', slot)).toMatchObject({ ok: false });
  });

  it('النص المش مقروء بيترفض', () => {
    expect(checkScheduleTime('بكرة الصبح', slot)).toMatchObject({ ok: false });
  });

  it('⚠️ الماضي بيترفض', () => {
    expect(checkScheduleTime('2026-10-05T17:00', slot + 60 * MIN)).toMatchObject({
      ok: false,
    });
  });

  it(`⚠️ وأقل من ${MIN_LEAD_MINUTES} دقيقة بيترفض كمان`, () => {
    // غرفة Daily بتفتح قبل الموعد بربع ساعة (`nbf`)، فجلسة بعد
    // خمس دقايق غرفتها اتفتحت خلاص. القيد ماشي مع سلوك الغرفة.
    expect(checkScheduleTime('2026-10-05T17:00', slot - 5 * MIN)).toMatchObject({
      ok: false,
    });
  });

  it('⚠️ وأبعد من سنة بيترفض — حارس على السنة المكتوبة غلط', () => {
    const result = checkScheduleTime('2026-10-05T17:00', slot - 400 * 24 * 60 * MIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('السنة');
  });
});
