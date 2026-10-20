import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone, phoneProblem, phoneErrorFor } from './phone';

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

  it('⚠️ بيرفض الرقم اللي فيه حروف حتى لو الأرقام كفاية (اختبار 3.8)', () => {
    expect(isValidPhone('abc01012345678')).toBe(false);
    expect(isValidPhone('call me 0101234567')).toBe(false);
    expect(isValidPhone('010x12345678')).toBe(false);
    expect(isValidPhone('010+12345678')).toBe(false);
  });

  it('بيقبل الأرقام العربية', () => {
    expect(isValidPhone('٠١٠١٢٣٤٥٦٧٨')).toBe(true);
    expect(normalizePhone('٠١٠ ١٢٣٤ ٥٦٧٨')).toBe('01012345678');
    expect(isValidPhone('۰۱۰۱۲۳۴۵۶۷۸')).toBe(true);
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

/* ════════════════════════════════════════════════════════════
   رقم **كامل** — ملاحظة تامر: «مش مجرد أرقام ومش كلام»
   ════════════════════════════════════════════════════════════ */
describe('phoneProblem — الدولة معروفة', () => {
  it('الموبايل المصري بكل صوره بيعدّي', () => {
    for (const v of [
      '01012345678',
      '01112345678',
      '01212345678',
      '01512345678',
      '+201012345678',
      '00201012345678',
      '1012345678',
      '٠١٠١٢٣٤٥٦٧٨',
      '010 1234 5678',
      '(010) 1234-5678',
    ]) {
      expect(phoneProblem(v, 'EG'), v).toBeNull();
    }
  });

  it('⚠️ «أرقام وبس» مش رقم تليفون — ودي الملاحظة نفسها', () => {
    // سبعة أرقام بتعدّي الحد الأدنى، وهي مش رقم مصري.
    expect(isValidPhone('1234567')).toBe(true);
    expect(phoneProblem('1234567', 'EG')).toBe('eg_length');
  });

  it('بداية غير موجودة في مصر بتترفض', () => {
    // 013/014/017/018/019 مش شبكات موجودة.
    expect(phoneProblem('01312345678', 'EG')).toBe('eg_mobile');
    expect(phoneProblem('01912345678', 'EG')).toBe('eg_mobile');
  });

  it('الموبايل الناقص أو الزايد رقم بيترفض', () => {
    expect(phoneProblem('0101234567', 'EG')).toBe('eg_mobile');
    expect(phoneProblem('010123456789', 'EG')).toBe('eg_mobile');
  });

  it('الأرضي المصري: ٩ أرقام وطنية', () => {
    expect(phoneProblem('0223456789', 'EG')).toBeNull(); // القاهرة
    expect(phoneProblem('0332345678', 'EG')).toBeNull(); // الإسكندرية
    expect(phoneProblem('022345678', 'EG')).toBe('eg_length');
  });

  it('⚠️ رقم أرضي بيبدأ بـ«20» مابيتبهدلش بشيل كود الدولة', () => {
    // «201234567» = ٢-٠١٢٣-٤٥٦٧ (القاهرة) — مش «+20» وبعده رقم.
    expect(phoneProblem('201234567', 'EG')).toBeNull();
  });

  it('الرقم المكرّر بيترفض في أي دولة', () => {
    expect(phoneProblem('00000000000', 'EG')).toBe('repeated');
    expect(phoneProblem('1111111', 'SA')).toBe('repeated');
    expect(isValidPhone('1111111')).toBe(false);
  });

  it('الكلام والفاضي ليهم رسايل مختلفة', () => {
    expect(phoneProblem('أهلاً', 'EG')).toBe('letters');
    expect(phoneProblem('call me', 'EG')).toBe('letters');
    expect(phoneProblem('', 'EG')).toBe('empty');
    expect(phoneProblem('   ', 'EG')).toBe('empty');
  });

  it('الدول التانية: الحد الأدنى بس — مفيش رفض كاذب', () => {
    expect(phoneProblem('+966501234567', 'SA')).toBeNull();
    expect(phoneProblem('+971501234567', 'AE')).toBeNull();
    expect(phoneProblem('+9611234567', 'LB')).toBeNull();
    expect(phoneProblem('12345', 'SA')).toBe('too_short');
    expect(phoneProblem('1234567890123456', 'SA')).toBe('too_long');
  });

  it('من غير دولة = الحد الأدنى (نموذج الدعم وطلب الانضمام)', () => {
    expect(phoneProblem('1234567')).toBeNull();
    expect(phoneProblem('12345')).toBe('too_short');
  });
});

describe('phoneErrorFor', () => {
  it('الرقم السليم = نص فاضي', () => {
    expect(phoneErrorFor('01012345678', 'EG')).toBe('');
  });

  it('⚠️ كل رسالة عربية، وبتقول الشكل الصح مش «غير صحيح»', () => {
    const mobile = phoneErrorFor('01312345678', 'EG');
    expect(mobile).toContain('٠١٠');
    expect(mobile).toContain('١١ رقم');
    expect(phoneErrorFor('أهلاً', 'EG')).toContain('حروف');
    expect(phoneErrorFor('', 'EG')).toContain('اكتب رقم تليفونك');
    // ومفيش رسالة إنجليزية ولا اسم حالة تقني ظاهر للعميل.
    for (const v of ['', 'أهلاً', '12345', '1111111111', '01312345678', '0223']) {
      const msg = phoneErrorFor(v, 'EG');
      expect(msg, v).not.toMatch(/[A-Za-z_]{3}/);
      expect(msg.length, v).toBeGreaterThan(10);
    }
  });
});
