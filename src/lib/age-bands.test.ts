import { describe, it, expect } from 'vitest';
import {
  AGE_BANDS,
  ageLabel,
  isAgeBandId,
  parseAgeInput,
  primaryAgeBand,
  productMatchesAgeBand,
} from './age-bands';

describe('الفئات نفسها', () => {
  it('حزم «بداية الرحلة» الأربع بالظبط، بلا فجوة ولا تداخل', () => {
    // ⚠️ لو حد عدّل فئة وساب فجوة (مثلًا ٦–٩ ثم ١١–١٢)، كتاب «١٠
    //    سنين» بيختفي من كل الفلاتر في صمت.
    expect(AGE_BANDS.map((b) => [b.min, b.max])).toEqual([
      [6, 9],
      [10, 12],
      [13, 17],
      [18, 20],
    ]);
    for (let i = 1; i < AGE_BANDS.length; i++) {
      expect(AGE_BANDS[i].min).toBe(AGE_BANDS[i - 1].max + 1);
    }
  });

  it('المعرّف من الرابط بيتحقّق منه — القيمة الغريبة مش فئة', () => {
    expect(isAgeBandId('6-9')).toBe(true);
    expect(isAgeBandId('3-5')).toBe(false);
    expect(isAgeBandId(undefined)).toBe(false);
  });
});

describe('المطابقة — تداخل مدى مع مدى', () => {
  it('🔴 كتاب «٨–١١» بيظهر تحت «٦–٩» و«١٠–١٢» الاتنين', () => {
    // ده السبب الوحيد إن السنّ اتخزّن رقمين لا فئة.
    const book = { minAge: 8, maxAge: 11 };
    expect(productMatchesAgeBand(book, '6-9')).toBe(true);
    expect(productMatchesAgeBand(book, '10-12')).toBe(true);
    expect(productMatchesAgeBand(book, '13-17')).toBe(false);
  });

  it('⚠️ المنتج اللي مالوش سنّ مابيطابقش أي فئة', () => {
    // عرضه تحت فئة معناه إننا بنخمّن — والأب واثق إن الموجود مناسب.
    for (const b of AGE_BANDS) {
      expect(productMatchesAgeBand({}, b.id)).toBe(false);
      expect(productMatchesAgeBand({ minAge: null, maxAge: null }, b.id)).toBe(false);
    }
  });

  it('«فأكبر» بيوصل لآخر فئة، مش بيقف عند أوّلها', () => {
    const teen = { minAge: 13, maxAge: null };
    expect(productMatchesAgeBand(teen, '13-17')).toBe(true);
    expect(productMatchesAgeBand(teen, '18-20')).toBe(true);
    expect(productMatchesAgeBand(teen, '10-12')).toBe(false);
  });

  it('الحدود نفسها داخلة: «٩» تحت «٦–٩» ومش تحت «١٠–١٢»', () => {
    expect(productMatchesAgeBand({ minAge: 9, maxAge: 9 }, '6-9')).toBe(true);
    expect(productMatchesAgeBand({ minAge: 9, maxAge: 9 }, '10-12')).toBe(false);
  });

  it('سنّ صفر رقم حقيقي مش «فاضي»', () => {
    // ⚠️ `if (!product.minAge)` كانت هتقرا الصفر «مفيش سنّ».
    expect(productMatchesAgeBand({ minAge: 0, maxAge: 7 }, '6-9')).toBe(true);
  });
});

describe('لون الشارة', () => {
  it('من فئة أصغر سنّ', () => {
    expect(primaryAgeBand({ minAge: 8, maxAge: 11 })?.id).toBe('6-9');
    expect(primaryAgeBand({ minAge: 14 })?.id).toBe('13-17');
  });

  it('تحت ٦ بياخد أقرب فئة، ومن غير سنّ مفيش شارة', () => {
    expect(primaryAgeBand({ minAge: 3, maxAge: 5 })?.id).toBe('6-9');
    expect(primaryAgeBand({})).toBeNull();
  });
});

describe('النص', () => {
  it('الصيغ التلاتة', () => {
    expect(ageLabel(8, 11)).toBe('من ٨ لـ١١ سنة');
    expect(ageLabel(6, 9)).toBe('من ٦ لـ٩ سنين');
    expect(ageLabel(13, null)).toBe('من ١٣ سنة فأكبر');
    expect(ageLabel(7, 7)).toBe('٧ سنين');
  });

  it('من غير سنّ: نص فاضي عشان الشارة تستخبى', () => {
    expect(ageLabel(undefined, undefined)).toBe('');
    expect(ageLabel(null, 9)).toBe('');
  });
});

describe('قراءة النموذج — نفس قيود ملف 132', () => {
  it('الخانتين فاضيين = مفيش سنّ، ومش خطأ', () => {
    expect(parseAgeInput('', '')).toEqual({ ok: true, minAge: null, maxAge: null });
    expect(parseAgeInput(null, null)).toEqual({ ok: true, minAge: null, maxAge: null });
  });

  it('الأرقام العربية بتتقبل', () => {
    // الإداري بيكتب بالكيبورد العربي — رفض «٦» بيتقري «الموقع مش فاهمني».
    expect(parseAgeInput('٦', '٩')).toEqual({ ok: true, minAge: 6, maxAge: 9 });
  });

  it('«من» لوحدها = فأكبر', () => {
    expect(parseAgeInput('13', '')).toEqual({ ok: true, minAge: 13, maxAge: null });
  });

  it('🔴 «لحد» لوحدها مرفوضة — القاعدة بترفضها كمان', () => {
    expect(parseAgeInput('', '9').ok).toBe(false);
  });

  it('المقلوب مرفوض', () => {
    expect(parseAgeInput('10', '6').ok).toBe(false);
  });

  it('الكسر والسالب والكلام والأكبر من ٢٠ مرفوضين', () => {
    for (const bad of ['7.5', '-3', 'سبعة', '21']) {
      expect(parseAgeInput(bad, '').ok).toBe(false);
    }
  });
});
