import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  activeDuration,
  allModulesDone,
  importCourseFile,
  readProgress,
  topicStats,
  trainingStatus,
  validateContent,
} from './training';
import { approvalSteps } from './instructor-approval';

const q = (id: string, correct = 1) => ({ id, q: `سؤال ${id}`, opts: ['أ', 'ب', 'ج'], correct, why: 'لأن' });
const content = {
  modules: [{ title: 'و١', subtitle: '', tag: 't', goal: 'g', pages: [{ title: 'ص', paragraphs: ['ف'] }], questions: [q('m1')] }],
  finalQuestions: [{ ...q('f1'), topic: 'ت١', critical: true }],
};

describe('استيراد الدورة', () => {
  it('بيقرا COURSE_DATA من ملف HTML زي v5، والمجالات من TOPICS', () => {
    const html = `<title>التأهيل | x</title><script>'use strict';
const COURSE_DATA = ${JSON.stringify(content)};
const TOPICS=["ت١"];
const REQUIRED_SCORE=85;
version:'1.2'</script>`;
    const r = importCourseFile(html);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content.modules).toHaveLength(1);
    expect(r.content.topics).toEqual(['ت١']);
    expect(r.version).toBe('1.2');
    expect(r.passPct).toBe(85);
  });

  it('⚠️ بيرفض سؤال من غير إجابة صحيحة صالحة', () => {
    const bad = { ...content, finalQuestions: [{ ...q('f1'), correct: 7 }] };
    expect(validateContent(bad).ok).toBe(false);
    expect(importCourseFile('<html>مفيش بيانات</html>').ok).toBe(false);
  });

  it('JSON مباشر مقبول', () => {
    expect(importCourseFile(JSON.stringify(content)).ok).toBe(true);
  });
});

describe('التقدّم', () => {
  const p = readProgress({ started_at: 'x', active_seconds: 3700, modules: { '0': { passedAt: '2026-10-24', attempts: 1, lastScore: 3, bestScore: 3, total: 3 } }, final_attempts: 0, passed_at: null });
  it('حالة المدرب', () => {
    expect(trainingStatus(null, 1)).toBe('not_started');
    expect(allModulesDone(p, 1)).toBe(true);
    expect(trainingStatus(p, 1)).toBe('ready_for_final');
    expect(trainingStatus(p, 2)).toBe('in_progress');
    expect(trainingStatus({ ...p!, passedAt: 'x' }, 2)).toBe('passed');
  });
  it('المدة والمجالات', () => {
    expect(activeDuration(3700)).toContain('س');
    expect(topicStats(['أ', 'ب'], [{ topic: 'أ', correct: true, selected: 0, right: '', why: '' }])).toEqual([
      { topic: 'أ', total: 1, correct: 1 },
    ]);
  });
});

describe('طريق الاعتماد', () => {
  const base = {
    instructor: { status: 'pending_training' as const, trainingPassed: false, bio: 'نبذة طويلة كفاية عن المدرب', specialties: ['x'] },
    certification: null,
    requests: [],
  };
  it('التأهيل خطوة بعد الملف لما الدورة متاحة', () => {
    const steps = approvalSteps({ ...base, foundation: { started: false, passed: false, required: true } });
    expect(steps.map((s) => s.key)).toEqual(['profile', 'foundation', 'training', 'exam', 'visible']);
    expect(steps[1].href).toBe('/dashboard/instructor/training');
  });
  it('من غير دورة الطريق زي ما هو', () => {
    expect(approvalSteps(base).map((s) => s.key)).toEqual(['profile', 'training', 'exam', 'visible']);
  });
});

// الملف الأصلي (لو موجود على الجهاز) — بيتأكد إن v5 نفسه بيتقري.
const REAL = process.env.TRAINING_HTML;
describe.runIf(!!REAL)('ملف v5 الحقيقي', () => {
  it('٦ وحدات و٢٠ سؤال نهائي و٤ حرجة', () => {
    const r = importCourseFile(readFileSync(REAL!, 'utf8'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content.modules).toHaveLength(6);
    expect(r.content.finalQuestions).toHaveLength(20);
    expect(r.content.finalQuestions.filter((x) => x.critical)).toHaveLength(4);
    expect(r.content.topics).toHaveLength(5);
    console.log('version', r.version, 'title', r.title, 'pass', r.passPct);
  });
});
