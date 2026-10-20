import { describe, it, expect } from 'vitest';
import { DEFAULT_GOALS, GOAL_LABEL_MAX, validateGoalInput } from './story-goals';

describe('validateGoalInput', () => {
  it('بيقص الفراغات', () => {
    expect(validateGoalInput({ label: '  الصبر  ' })).toEqual({ ok: true, label: 'الصبر' });
  });

  it('فاضي أو قصير أو طويل = خطأ', () => {
    expect(validateGoalInput({ label: '' }).ok).toBe(false);
    expect(validateGoalInput({ label: 5 }).ok).toBe(false);
    expect(validateGoalInput({ label: 'أ' }).ok).toBe(false);
    expect(validateGoalInput({ label: 'أ'.repeat(GOAL_LABEL_MAX + 1) }).ok).toBe(false);
    expect(validateGoalInput({ label: 'أ'.repeat(GOAL_LABEL_MAX) }).ok).toBe(true);
  });

  it("'other' محجوزة", () => {
    expect(validateGoalInput({ label: 'Other' }).ok).toBe(false);
  });
});

describe('DEFAULT_GOALS', () => {
  it('الأربعة القدام بنفس الكلام ولكل المنتجات', () => {
    expect(DEFAULT_GOALS.map((g) => g.label)).toEqual([
      'الشجاعة والتغلب على الخوف',
      'بناء الثقة بالنفس',
      'تعلم حل المشكلات',
      'التعاون مع الآخرين',
    ]);
    expect(DEFAULT_GOALS.every((g) => g.appliesTo === null && g.isActive)).toBe(true);
  });
});
