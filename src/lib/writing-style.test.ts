import { describe, expect, it } from 'vitest';
import {
  availableStyles,
  buildWritingStyleValue,
  describeWritingStyle,
  parseWritingStylesInput,
  validateDialectInput,
  writingStyleProblem,
} from './writing-style';

const dialects = [
  { code: 'egyptian', nameAr: 'اللهجة المصرية' },
  { code: 'gulf', nameAr: 'اللهجة الخليجية' },
];

describe('availableStyles', () => {
  it('null/فاضي = كل الأساليب', () => {
    expect(availableStyles(null)).toEqual(['fusha', 'simple', 'dialect']);
    expect(availableStyles([])).toEqual(['fusha', 'simple', 'dialect']);
  });
  it('بيحترم القائمة المحددة وبيتجاهل الغريب', () => {
    expect(availableStyles(['simple', 'zzz'])).toEqual(['simple']);
  });
  it('قائمة كلها غريبة = ما نقفلش الاختيار', () => {
    expect(availableStyles(['zzz'])).toEqual(['fusha', 'simple', 'dialect']);
  });
});

describe('buildWritingStyleValue', () => {
  it('فصحى ومبسطة من غير لهجة', () => {
    expect(buildWritingStyleValue('fusha', 'gulf', dialects)).toEqual({ style: 'fusha' });
    expect(buildWritingStyleValue('simple', undefined, dialects)).toEqual({ style: 'simple' });
  });
  it('لهجة صالحة', () => {
    expect(buildWritingStyleValue('dialect', 'gulf', dialects)).toEqual({ style: 'dialect', dialect: 'gulf' });
  });
  it('لهجة ناقصة أو غير معروفة = null', () => {
    expect(buildWritingStyleValue('dialect', '', dialects)).toBeNull();
    expect(buildWritingStyleValue('dialect', 'mars', dialects)).toBeNull();
  });
  it('أسلوب غير معروف أو غير موجود = null', () => {
    expect(buildWritingStyleValue('x', undefined, dialects)).toBeNull();
    expect(buildWritingStyleValue(undefined, undefined, dialects)).toBeNull();
  });
});

describe('writingStyleProblem', () => {
  it('بدون اختيار', () => {
    expect(writingStyleProblem(undefined, undefined, dialects, null)).toBe('اختار أسلوب الكتابة');
  });
  it('أسلوب غير مسموح للمنتج', () => {
    expect(writingStyleProblem('fusha', undefined, dialects, ['simple'])).toMatch(/مش متاح/);
  });
  it('لهجة بلا اختيار لهجة', () => {
    expect(writingStyleProblem('dialect', '', dialects, null)).toBe('اختار اللهجة المطلوبة');
  });
  it('لهجة وقائمة اللهجات فاضية', () => {
    expect(writingStyleProblem('dialect', 'gulf', [], null)).toMatch(/غير متاحة/);
  });
  it('اختيار سليم', () => {
    expect(writingStyleProblem('simple', undefined, dialects, null)).toBeNull();
    expect(writingStyleProblem('dialect', 'egyptian', dialects, ['dialect'])).toBeNull();
  });
});

describe('describeWritingStyle', () => {
  it('بيترجم الأساليب', () => {
    expect(describeWritingStyle({ style: 'fusha' })).toBe('فصحى');
    expect(describeWritingStyle({ style: 'simple' })).toBe('عربية مبسطة');
  });
  it('اللهجة باسمها أو بالكود لو اتشالت', () => {
    expect(describeWritingStyle({ style: 'dialect', dialect: 'gulf' }, dialects)).toBe('اللهجة الخليجية');
    expect(describeWritingStyle({ style: 'dialect', dialect: 'old' }, dialects)).toBe('لهجة (old)');
    // اسم احتياطي للّهجات المبذورة لو القايمة مش متاحة (صفحة الإدارة)
    expect(describeWritingStyle({ style: 'dialect', dialect: 'iraqi' })).toBe('اللهجة العراقية');
  });
  it('قيمة غريبة = null', () => {
    expect(describeWritingStyle(null)).toBeNull();
    expect(describeWritingStyle('x')).toBeNull();
    expect(describeWritingStyle({ style: 'zzz' })).toBeNull();
    expect(describeWritingStyle([])).toBeNull();
  });
});

describe('parseWritingStylesInput', () => {
  it('الثلاثة = بدون تقييد', () => {
    expect(parseWritingStylesInput(['dialect', 'fusha', 'simple'])).toEqual({ ok: true, styles: null });
  });
  it('اختيار جزئي بترتيب ثابت', () => {
    expect(parseWritingStylesInput(['simple', 'fusha'])).toEqual({ ok: true, styles: ['fusha', 'simple'] });
  });
  it('ولا واحد أو غريب بس = خطأ', () => {
    expect(parseWritingStylesInput([]).ok).toBe(false);
    expect(parseWritingStylesInput(['zzz']).ok).toBe(false);
  });
  it('الغريب بيتتجاهل', () => {
    expect(parseWritingStylesInput(['simple', 'zzz'])).toEqual({ ok: true, styles: ['simple'] });
  });
});

describe('validateDialectInput', () => {
  it('كود واسم سليمين', () => {
    expect(validateDialectInput(' jordanian ', ' اللهجة الأردنية ')).toEqual({
      ok: true,
      code: 'jordanian',
      nameAr: 'اللهجة الأردنية',
    });
  });
  it('كود غير صالح', () => {
    expect(validateDialectInput('Jordanian', 'x').ok).toBe(false);
    expect(validateDialectInput('a', 'x').ok).toBe(false);
    expect(validateDialectInput('has space', 'x').ok).toBe(false);
  });
  it('اسم فاضي أو طويل', () => {
    expect(validateDialectInput('gulf', '  ').ok).toBe(false);
    expect(validateDialectInput('gulf', 'ا'.repeat(61)).ok).toBe(false);
  });
});
