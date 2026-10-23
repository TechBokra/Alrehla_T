import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REVIEW_BLOCKED_MESSAGE, bookingReviewState } from './review-eligibility';

const s = (...statuses: string[]) => statuses.map((status) => ({ status }));

describe('bookingReviewState', () => {
  it('كل الجلسات تمّت = ينفع يقيّم', () => {
    const state = bookingReviewState(s('completed', 'completed', 'completed'));
    expect(state).toEqual({ can: true, completedCount: 3 });
  });

  it('⚠️ جلسة واحدة جاية = لأ — «بعد الانتهاء» مش «خلاله»', () => {
    for (const open of ['scheduled', 'confirmed', 'pending']) {
      const state = bookingReviewState(s('completed', open));
      expect(state, open).toEqual({ can: false, reason: 'in_progress' });
    }
  });

  it('تمّت + اتلغت = خلصت، وينفع تتقيّم', () => {
    expect(bookingReviewState(s('completed', 'cancelled'))).toEqual({
      can: true,
      completedCount: 1,
    });
  });

  /**
   * ⚠️ أخطر حالة: كل الجلسات اتلغت. الطالب ماشافش المدرب ولا مرة —
   *    ورأي من غير تجربة أسوأ من مفيش رأي.
   */
  it('كل الجلسات اتلغت = مفيش تجربة تتقيّم', () => {
    expect(bookingReviewState(s('cancelled', 'cancelled'))).toEqual({
      can: false,
      reason: 'never_met',
    });
  });

  /**
   * ⚠️ القايمة الفاضية معناها الإدارة لسه ما جدولتش — مش إن الباقة
   *    خلصت. من غير الفحص ده، باقة اتدفعت من دقيقة بتبقى «جاهزة».
   */
  it('مفيش جلسات خالص = لسه مابدأتش', () => {
    expect(bookingReviewState([])).toEqual({ can: false, reason: 'no_sessions' });
  });

  it('المقيَّمة قبل كده بتترفض قبل أي فحص تاني', () => {
    expect(bookingReviewState(s('completed'), true)).toEqual({
      can: false,
      reason: 'already_reviewed',
    });
    // وحتى لو لسه شغّالة — السبب الأول هو اللي يتقال.
    expect(bookingReviewState(s('scheduled'), true)).toEqual({
      can: false,
      reason: 'already_reviewed',
    });
  });

  it('كل سبب ليه رسالة عربية مفيدة', () => {
    for (const [reason, msg] of Object.entries(REVIEW_BLOCKED_MESSAGE)) {
      expect(msg, reason).not.toMatch(/[A-Za-z_]{3}/);
      expect(msg.length, reason).toBeGreaterThan(20);
    }
  });
});

/**
 * ⚠️ **شرط «بعد الانتهاء» لازم يفضل على الخادم.** الشاشة بتخفي
 *    النموذج، والإخفاء بيتخطّى بنداء مباشر (قاعدة «ع»).
 */
describe('الحارس على الخادم', () => {
  const src = readFileSync(new URL('../actions/reviews.ts', import.meta.url), 'utf8');

  it('تقييم طلب الخدمة بيترفض قبل الاكتمال', () => {
    expect(src).toMatch(/status !== 'completed'/);
    expect(src).toContain('يمكن التقييم بعد اكتمال الطلب فقط');
  });

  it('تقييم الباقة بيفحص الأهلية بنفس الدالة اللي الشاشة بتستعملها', () => {
    expect(src).toMatch(/bookingReviewState\(/);
  });
});
