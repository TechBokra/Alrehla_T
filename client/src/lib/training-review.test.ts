import { describe, it, expect } from 'vitest';
import { attemptSignals, readAdminReview } from './training-review';
import type { CourseContent } from './training';

const content = {
  modules: [],
  topics: [],
  finalQuestions: [
    { id: 'b1', q: 'موقف طفل ٧', opts: ['أ', 'ب'], correct: 1, why: '', adminBand: 'A' },
    { id: 'x', q: 'عام', opts: ['أ', 'ب'], correct: 0, why: '' },
    {
      id: 'open',
      type: 'open_response',
      q: 'كيف تساند؟',
      opts: [],
      correct: 0,
      why: '',
      fields: [
        { id: 'age7', label: '7 سنوات' },
        { id: 'dialogue', label: 'حوار' },
      ],
    },
  ],
  adminFollowups: { x: { '1': ['الحماية', 'ملاحظة', 'متابعة'] } },
} as unknown as CourseContent;

describe('attemptSignals', () => {
  it('بيجمع موقف كل فئة وكتابتها وملاحظات المتابعة', () => {
    const s = attemptSignals(content, { b1: 1, x: 1 }, { open: { age7: ' أبدأ بسؤال ', dialogueAge: 'age7' } });
    expect(s.bands[0]).toMatchObject({ code: 'A', written: 'أبدأ بسؤال', situation: { aligned: true, picked: 'ب' } });
    expect(s.bands[1]).toMatchObject({ code: 'B', situation: null, written: null });
    expect(s.followups).toHaveLength(1);
    expect(s.followups[0]).toMatchObject({ questionNumber: 2, category: 'الحماية' });
    expect(s.open[0].dialogueAge).toBe('7 سنوات');
  });

  it('محاولة قديمة من غير سؤال كتابة مابتكسرش', () => {
    const s = attemptSignals(content, null, null);
    expect(s.bands.every((b) => b.written === null)).toBe(true);
  });
});

describe('readAdminReview', () => {
  it('بيقبل القيم المعروفة بس', () => {
    expect(readAdminReview({ bands: { A: 'recommended', B: 'zzz' }, note: 'تمام' })).toEqual({
      bands: { A: 'recommended' },
      note: 'تمام',
    });
    expect(readAdminReview(null)).toBeNull();
  });
});
