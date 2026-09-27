import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone } from './phone';

/**
 * ⚠️ **الاختبارات دي بتحرس بلاغًا حقيقيًا من فريق العمل:**
 * «الموقع بيقبل كتابة حروف في مكان التليفون».
 *
 * والسبب إن `type="tel"` **مش بيمنع الحروف** — بيغيّر لوحة مفاتيح
 * الموبايل وبس. فالإدارة كانت بتفتح طلبًا عليه رقم مكتوب فيه كلام.
 */
describe('تنظيف الرقم', () => {
  it('بيشيل التنسيق ويسيب الأرقام', () => {
    expect(normalizePhone('010 1234 5678')).toBe('01012345678');
    expect(normalizePhone('(010) 123-45678')).toBe('01012345678');
  });

  it('بيحافظ على + الدولية في الأول بس', () => {
    expect(normalizePhone('+20 100 123 4567')).toBe('+201001234567');
    // + في النص مش علامة دولية — بتتشال.
    expect(normalizePhone('010+1234')).toBe('0101234');
  });

  it('بيشيل الحروف', () => {
    expect(normalizePhone('أهلاً')).toBe('');
    expect(normalizePhone('call me 0101234567')).toBe('0101234567');
  });

  it('الفاضي والغايب', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('   ')).toBe('');
  });
});

describe('التحقّق', () => {
  it('بيقبل الأرقام المصرية والدولية', () => {
    expect(isValidPhone('01012345678')).toBe(true);
    expect(isValidPhone('+201012345678')).toBe(true);
    expect(isValidPhone('+966501234567')).toBe(true);
  });

  it('بيرفض الحروف — وده البلاغ نفسه', () => {
    expect(isValidPhone('أهلاً وسهلاً')).toBe(false);
    expect(isValidPhone('not a phone')).toBe(false);
  });

  it('بيرفض القصير والطويل', () => {
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false);
  });

  it('⚠️ بيقبل الرقم المكتوب بتنسيق — الرفض الكاذب بيخسّر عميلًا', () => {
    expect(isValidPhone('010 1234 5678')).toBe(true);
    expect(isValidPhone('(010) 1234-5678')).toBe(true);
  });

  it('الفاضي مش صالح', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});
