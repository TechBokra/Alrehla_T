import { describe, it, expect } from 'vitest';
import {
  answerKey,
  checkExtraAnswers,
  moveItem,
  readExtraAnswers,
  snapshotAnswers,
  validateFieldInput,
  type CustomizationField,
} from './customization-fields';

const field = (id: string, label: string, isRequired = false): CustomizationField => ({
  id,
  label,
  isRequired,
  isActive: true,
  sortOrder: 0,
});

const fields = [field('1a', 'لون مفضل', true), field('2b', 'اسم الأخ')];

describe('خانات التخصيص — اللوحة', () => {
  it('الاسم مطلوب ومتقصّص من المسافات', () => {
    expect(validateFieldInput({ label: '  ' })).toEqual({
      ok: false,
      error: 'اكتب اسم الخانة زي ما هيظهر للعميل',
    });
    expect(validateFieldInput({ label: ' لون ', placeholder: '' })).toEqual({
      ok: true,
      label: 'لون',
      placeholder: null,
    });
    expect(validateFieldInput({ label: 'x'.repeat(81) }).ok).toBe(false);
    expect(validateFieldInput({ label: 'x', placeholder: 'y'.repeat(121) }).ok).toBe(false);
  });
});

describe('خانات التخصيص — العميل', () => {
  it('⚠️ اسم الخانة في النموذج بيبدأ بحرف (react-hook-form بيقرا الأرقام كمصفوفة)', () => {
    expect(answerKey('123')).toBe('f_123');
  });

  it('الإلزامية الفاضية بترجّع رسالة باسمها', () => {
    expect(checkExtraAnswers(fields, {})).toBe('لون مفضل: الخانة دي مطلوبة');
    expect(checkExtraAnswers(fields, { f_1a: '   ' })).toBe('لون مفضل: الخانة دي مطلوبة');
    expect(checkExtraAnswers(fields, { f_1a: 'أزرق' })).toBeNull();
    expect(checkExtraAnswers(fields, undefined)).toBe('لون مفضل: الخانة دي مطلوبة');
    expect(checkExtraAnswers([], undefined)).toBeNull();
  });

  it('الإجابة الطويلة بتترفض', () => {
    expect(checkExtraAnswers(fields, { f_1a: 'x'.repeat(151) })).toContain('أطول');
  });

  it('المحفوظ في الطلب: المتملّي بس ومعاه اسم الخانة', () => {
    expect(snapshotAnswers(fields, { f_1a: ' أزرق ', f_2b: '' })).toEqual([
      { id: '1a', label: 'لون مفضل', value: 'أزرق' },
    ]);
  });

  it('قراءة طلب محفوظ بتتجاهل أي شكل غريب', () => {
    expect(
      readExtraAnswers([
        { id: '1', label: 'لون', value: 'أحمر' },
        { label: 'فاضي', value: ' ' },
        'كلام',
        null,
        { label: 5, value: 'x' },
      ]),
    ).toEqual([{ label: 'لون', value: 'أحمر' }]);
    expect(readExtraAnswers('مش مصفوفة')).toEqual([]);
  });
});

describe('الترتيب بالأسهم', () => {
  it('↑ و↓', () => {
    expect(moveItem(['أ', 'ب', 'ج'], 1, -1)).toEqual(['ب', 'أ', 'ج']);
    expect(moveItem(['أ', 'ب', 'ج'], 1, 1)).toEqual(['أ', 'ج', 'ب']);
  });
  it('أول القايمة لفوق وآخرها لتحت = مفيش حركة', () => {
    expect(moveItem(['أ', 'ب'], 0, -1)).toBeNull();
    expect(moveItem(['أ', 'ب'], 1, 1)).toBeNull();
  });
});
