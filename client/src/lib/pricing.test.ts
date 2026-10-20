import { describe, it, expect } from 'vitest';
import { calculateFinalSessionPrice } from '@/lib/utils';

/**
 * معادلة التسعير.
 *
 * دي أكتر حتة في المشروع الفلوس بتمر منها: سعر الجلسة، وسعر الخدمة
 * الإبداعية، ونصيب الناشر — كلهم بيستخدموها أو بيعكسوها.
 *
 * الاختبارات دي بتثبّت **سلوك متفق عليه مع صاحب المشروع**، مش مجرد
 * تنفيذ حالي. لو حد غيّر المعادلة بعدين، لازم يعدي على القرار ده الأول.
 */
describe('معادلة التسعير', () => {
  it('سعر العميل = حصيلة المدرب × المعامل + الرسم الثابت', () => {
    expect(
      calculateFinalSessionPrice(100, { platformMultiplier: 1.5, fixedAdminFee: 20 }),
    ).toBe(170);
  });

  it('معامل 1 ورسم 0 يعني المنصة لا تأخذ شيئًا — وهو الوضع الافتراضي في قاعدة البيانات', () => {
    expect(
      calculateFinalSessionPrice(250, { platformMultiplier: 1, fixedAdminFee: 0 }),
    ).toBe(250);
  });

  it('حصيلة صفر تعطي الرسم الثابت وحده', () => {
    expect(
      calculateFinalSessionPrice(0, { platformMultiplier: 2, fixedAdminFee: 30 }),
    ).toBe(30);
  });

  it('الكسور العشرية لا تُقرَّب داخل المعادلة — التقريب قرار عرض لا حساب', () => {
    expect(
      calculateFinalSessionPrice(99.5, { platformMultiplier: 1.2, fixedAdminFee: 0 }),
    ).toBeCloseTo(119.4, 5);
  });
});

/**
 * عكس المعادلة — نصيب الناشر.
 *
 * لوحة الناشر بتعرض نصيبه من سعر بيع المنتج، فبتعكس المعادلة:
 *
 *     نصيب الناشر = (سعر العميل − الرسم الثابت) ÷ المعامل
 *
 * الدالة دي نسخة من المنطق اللي في `getPublisherOrders` عشان نقدر
 * نختبره من غير قاعدة بيانات. لو المنطق هناك اتغيّر، الاختبار ده لازم
 * يتغيّر معاه — وده مقصود: بيجبر أي تعديل يمر على قرار واعٍ.
 */
function publisherShare(
  unitPrice: number,
  formula: { platformMultiplier: number; fixedAdminFee: number },
): number {
  const multiplier = formula.platformMultiplier > 0 ? formula.platformMultiplier : 1;
  return Math.max(0, (unitPrice - formula.fixedAdminFee) / multiplier);
}

describe('نصيب الناشر — عكس المعادلة', () => {
  it('يعيد الحصيلة الأصلية بالظبط لما نعكس المعادلة', () => {
    const formula = { platformMultiplier: 1.4, fixedAdminFee: 25 };
    const customerPrice = calculateFinalSessionPrice(200, formula);
    expect(publisherShare(customerPrice, formula)).toBeCloseTo(200, 5);
  });

  it('لا ينزل تحت الصفر لو الرسم الثابت أكبر من سعر الوحدة', () => {
    expect(publisherShare(10, { platformMultiplier: 1, fixedAdminFee: 50 })).toBe(0);
  });

  it('معامل صفر لا يُنتج قسمة على صفر', () => {
    const result = publisherShare(100, { platformMultiplier: 0, fixedAdminFee: 0 });
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(100);
  });
});
