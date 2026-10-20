import { describe, expect, it } from 'vitest';
import { buildSessionSchedule } from './session-schedule';
import { cairoParts } from './timezone';
import type { WeeklySlot } from '@/types';

/**
 * ⚠️ كل التحقق هنا بـ`cairoParts` مش بـ`getHours()`.
 *
 * `getHours()` بتقرا بتوقيت الجهاز: على جهاز في مصر بتدي 17، وعلى خادم
 * Vercel بتدي 14 لنفس اللحظة. الاختبار اللي بيستخدمها بيعدّي على جهاز
 * التطوير ويفشل في الإنتاج — وده اللي خلّى عطل الثلاث ساعات يعدّي.
 * (والاختبارات كلها بتشتغل `TZ=UTC` دلوقتي — انظر `vitest.config.ts`.)
 */

/** الثلاثاء ١٦ سبتمبر ٢٠٢٥، الساعة ١٢ ظهرًا بتوقيت القاهرة. */
const FROM = new Date('2025-09-16T09:00:00.000Z');

describe('buildSessionSchedule', () => {
  it('بيعمل عدد الجلسات المطلوب', () => {
    expect(buildSessionSchedule({ count: 8, from: FROM })).toHaveLength(8);
  });

  it('بيرجع فاضي لو الباقة بلا جلسات', () => {
    expect(buildSessionSchedule({ count: 0, from: FROM })).toEqual([]);
  });

  it('بيحط أسبوع كامل بين كل جلستين', () => {
    const dates = buildSessionSchedule({ count: 3, from: FROM }).map(
      (d) => new Date(d).getTime()
    );
    const week = 7 * 24 * 60 * 60 * 1000;
    expect(dates[1] - dates[0]).toBe(week);
    expect(dates[2] - dates[1]).toBe(week);
  });

  it('بيبدأ بعد يومين على الأقل — مش نفس اليوم', () => {
    const first = new Date(buildSessionSchedule({ count: 1, from: FROM })[0]);
    expect(first.getTime()).toBeGreaterThanOrEqual(
      FROM.getTime() + 2 * 24 * 60 * 60 * 1000
    );
  });

  it('بيمشي على يوم وساعة جدول المدرب بتوقيت القاهرة', () => {
    const schedule: WeeklySlot[] = [{ day: 'monday', time: '17:30' }];
    const dates = buildSessionSchedule({ count: 4, from: FROM, weeklySchedule: schedule });

    for (const iso of dates) {
      const p = cairoParts(new Date(iso));
      expect(p.weekday).toBe(1); // الإتنين
      expect(p.hour).toBe(17);
      expect(p.minute).toBe(30);
    }
  });

  it('١٧:٣٠ في الجدول = ١٧:٣٠ في القاهرة مش في UTC', () => {
    // الاختبار ده هو اللي بيمسك العطل الأصلي: الجلسة كانت بتتسجّل
    // 17:30 UTC، يعني ٢٠:٣٠ بتوقيت القاهرة.
    const schedule: WeeklySlot[] = [{ day: 'monday', time: '17:30' }];
    const first = new Date(
      buildSessionSchedule({ count: 1, from: FROM, weeklySchedule: schedule })[0]
    );
    expect(cairoParts(first).hour).toBe(17);
    // سبتمبر = توقيت صيفي في مصر (UTC+3)، فالمخزَّن لازم يبقى ١٤:٣٠.
    expect(first.getUTCHours()).toBe(14);
  });

  it('الميعاد بيفضل ثابت على ساعة الحيطة بعد انتهاء التوقيت الصيفي', () => {
    // التوقيت الصيفي في مصر بيخلص آخر أكتوبر. باقة بتعدّي عليه كانت
    // بتزحلق ميعاد الطالب ساعة كاملة، لأن «أسبوع» كانت ٧×٢٤ ساعة بدل
    // سبع أيام تقويمية.
    const schedule: WeeklySlot[] = [{ day: 'monday', time: '18:00' }];
    const dates = buildSessionSchedule({
      count: 10,
      from: new Date('2025-10-06T09:00:00.000Z'),
      weeklySchedule: schedule,
    });

    for (const iso of dates) {
      const p = cairoParts(new Date(iso));
      expect(p.weekday).toBe(1);
      expect(p.hour).toBe(18);
      expect(p.minute).toBe(0);
    }
  });

  it('بيختار أول ميعاد في الأسبوع ويتجاهل المحجوز', () => {
    const schedule: WeeklySlot[] = [
      { day: 'wednesday', time: '10:00' },
      { day: 'sunday', time: '09:00', isBooked: true },
      { day: 'monday', time: '18:00' },
    ];
    const first = new Date(
      buildSessionSchedule({ count: 1, from: FROM, weeklySchedule: schedule })[0]
    );
    // الأحد محجوز، فأول ميعاد متاح هو الإتنين.
    const p = cairoParts(first);
    expect(p.weekday).toBe(1);
    expect(p.hour).toBe(18);
  });

  it('اختيار العميل بيغلب أول ميعاد في جدول المدرب', () => {
    // الجدول أوله الأحد، والعميل اختار الأربعاء. الجلسات لازم تبقى
    // على اختيار العميل — ده اللي شافه في ملخص الحجز.
    const schedule: WeeklySlot[] = [
      { day: 'sunday', time: '09:00' },
      { day: 'wednesday', time: '19:00' },
    ];
    const dates = buildSessionSchedule({
      count: 3,
      from: FROM,
      weeklySchedule: schedule,
      preferredSlot: { day: 'wednesday', time: '19:00' },
    });
    expect(dates).toHaveLength(3);
    for (const iso of dates) {
      const p = cairoParts(new Date(iso));
      expect(p.weekday).toBe(3);
      expect(p.hour).toBe(19);
    }
  });

  it('اختيار بايظ بيترجع لجدول المدرب بدل ما يولّد مواعيد غلط', () => {
    const schedule: WeeklySlot[] = [{ day: 'monday', time: '17:30' }];
    const first = new Date(
      buildSessionSchedule({
        count: 1,
        from: FROM,
        weeklySchedule: schedule,
        // يوم مش موجود في أيام الأسبوع
        preferredSlot: { day: 'funday' as never, time: '19:00' },
      })[0]
    );
    const p = cairoParts(first);
    expect(p.weekday).toBe(1);
    expect(p.hour).toBe(17);
  });

  it('جدول فاضي = أسبوعي من أول ميعاد متاح بعد يومين', () => {
    const dates = buildSessionSchedule({ count: 2, from: FROM, weeklySchedule: [] });
    expect(dates).toHaveLength(2);
    // مفيش جدول للمدرب، فالبداية بعد يومين بالظبط والباقي كل أسبوع.
    expect(new Date(dates[0]).getTime()).toBe(FROM.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect(cairoParts(new Date(dates[1])).weekday).toBe(
      cairoParts(new Date(dates[0])).weekday
    );
  });
});
