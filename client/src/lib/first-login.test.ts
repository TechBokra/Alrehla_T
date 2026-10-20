import { describe, it, expect } from 'vitest';
import { needsPasswordSetup, generateTempCode, MUST_SET_PASSWORD } from './first-login';

/**
 * ⚠️ **الاختبار ده بيحرس حاجزًا أمنيًّا، مش تنسيق نص.**
 *
 * `needsPasswordSetup` هي اللي بتقرر هل الحساب يتوقف على شاشة «حط كلمة
 * مرورك» ولا يعدّي. ولو رجّعت `false` غلط، يبقى حساب داخل برمز مرّ على
 * واتساب بقى شغّالًا على طول.
 *
 * فالحالات اللي تحت مش استعراضًا: كل واحدة منها شكل حقيقي ممكن يوصل من
 * Supabase.
 */
describe('needsPasswordSetup', () => {
  it('تقول آه للعلامة المضبوطة', () => {
    expect(needsPasswordSetup({ app_metadata: { [MUST_SET_PASSWORD]: true } })).toBe(true);
  });

  it('تقول لأ للحساب العادي', () => {
    expect(needsPasswordSetup({ app_metadata: { provider: 'email' } })).toBe(false);
    expect(needsPasswordSetup({ app_metadata: { [MUST_SET_PASSWORD]: false } })).toBe(false);
  });

  it('تقول لأ للغايب والفاضي', () => {
    expect(needsPasswordSetup(null)).toBe(false);
    expect(needsPasswordSetup(undefined)).toBe(false);
    expect(needsPasswordSetup({})).toBe(false);
    expect(needsPasswordSetup({ app_metadata: null })).toBe(false);
  });

  it('المقارنة بالمطابقة التامة — النص "true" مش صح', () => {
    // ⚠️ لو المقارنة كانت `== true` أو مجرد قيمة صادقة، أي قيمة نصية
    //    كانت هتقفل الحساب على الشاشة للأبد. والعكس أخطر: قيمة غريبة
    //    تفتح الحاجز.
    expect(needsPasswordSetup({ app_metadata: { [MUST_SET_PASSWORD]: 'true' } })).toBe(false);
    expect(needsPasswordSetup({ app_metadata: { [MUST_SET_PASSWORD]: 1 } })).toBe(false);
  });
});

describe('generateTempCode', () => {
  it('مفيش حروف ملتبسة — الرمز بيتقال في تليفون', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTempCode()).not.toMatch(/[lI1O0]/);
    }
  });

  it('شكله ثابت: 4-4-4', () => {
    expect(generateTempCode()).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);
  });

  it('مش بيتكرر', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTempCode()));
    expect(seen.size).toBe(500);
  });

  it('أطول من الحد الأدنى لكلمة المرور', () => {
    // Supabase بيرفض أقل من 6، وشاشتنا بتطلب 8. الرمز لازم يعدّي
    // الاتنين وإلا إنشاء الحساب نفسه بيقع.
    expect(generateTempCode().replace(/-/g, '').length).toBeGreaterThanOrEqual(8);
  });
});
