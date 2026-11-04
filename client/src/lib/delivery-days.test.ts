import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DELIVERY_DAYS,
  daysLabel,
  effectiveDeliveryDays,
  expectedReadyDate,
  normalizeDeliveryDays,
  productDayOverride,
} from './delivery-days';
import { waitDays, imageReviewState, latestImagePerItem, imageNoteProblem } from './image-review';

describe('delivery days', () => {
  it('القيمة العامة: الرقم البايظ بيرجع للافتراضي', () => {
    expect(normalizeDeliveryDays(undefined)).toEqual(DEFAULT_DELIVERY_DAYS);
    expect(normalizeDeliveryDays({ electronic: '3', printed: 0 })).toEqual({ electronic: 3, printed: DEFAULT_DELIVERY_DAYS.printed });
  });

  it('الكتاب بيغيّر القيمة العامة، والفاضي = العامة', () => {
    const g = { electronic: 5, printed: 10 };
    expect(effectiveDeliveryDays(g, { deliveryDaysPrinted: 14 })).toEqual({ electronic: 5, printed: 14 });
    expect(effectiveDeliveryDays(g, { deliveryDaysElectronic: null })).toEqual(g);
    expect(effectiveDeliveryDays(g, null)).toEqual(g);
  });

  it('خانة الكتاب الفاضية أو البايظة = null', () => {
    expect(productDayOverride('')).toBeNull();
    expect(productDayOverride(500)).toBeNull();
    expect(productDayOverride('7')).toBe(7);
  });

  it('أسماء الأيام', () => {
    expect(daysLabel(1)).toBe('يوم واحد');
    expect(daysLabel(2)).toBe('يومين');
    expect(daysLabel(5)).toContain('أيام');
    expect(daysLabel(14)).toContain('يوم');
  });

  it('⚠️ انتظار قرار العميل بيأخّر الميعاد بنفس المدة', () => {
    const base = expectedReadyDate('2026-10-01T10:00:00Z', 10);
    const late = expectedReadyDate('2026-10-01T10:00:00Z', 10, 3);
    expect((late.getTime() - base.getTime()) / 86_400_000).toBe(3);
  });
});

describe('image review', () => {
  const row = {
    projectId: 'p', orderItemId: 'i', productId: 'x', reviewId: 'r', imageUrl: 'https://x',
    staffNote: null, status: 'pending', sentAt: '2026-10-01T10:00:00Z', decidedAt: null,
    clientNote: null, characterApproved: false,
  };

  it('مدة الانتظار: من الإرسال للقرار، واللي لسه مستني لحد دلوقتي', () => {
    expect(waitDays([{ ...row, decidedAt: '2026-10-01T20:00:00Z' }])).toBe(0);
    expect(waitDays([{ ...row, decidedAt: '2026-10-03T11:00:00Z' }])).toBe(2);
    expect(waitDays([row], new Date('2026-10-05T10:00:00Z'))).toBe(4);
  });

  it('صورة مستنية بس الفريق اعتمد المرجع = اتعتمدت (من غير زرار)', () => {
    expect(imageReviewState(row).kind).toBe('awaiting');
    expect(imageReviewState({ ...row, characterApproved: true }).kind).toBe('approved');
    expect(imageReviewState({ ...row, status: 'weird' }).kind).toBe('closed');
  });

  it('أحدث صورة لكل بند', () => {
    expect(latestImagePerItem([row, { ...row, reviewId: 'old' }]).map((r) => r.reviewId)).toEqual(['r']);
  });

  it('ملاحظة التعديل لازمة', () => {
    expect(imageNoteProblem(' ')).not.toBeNull();
    expect(imageNoteProblem('الشعر أطول')).toBeNull();
  });
});
