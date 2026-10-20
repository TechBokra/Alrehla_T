import { describe, expect, it } from 'vitest';
import {
  approvalHeadline,
  approvalSteps,
  currentStep,
  isAdminHold,
  type ApprovalInput,
} from './instructor-approval';

const base: ApprovalInput = {
  instructor: {
    status: 'pending_training',
    trainingPassed: false,
    bio: null,
    specialties: null,
  },
  certification: null,
  requests: [],
};

const withInstructor = (over: Partial<ApprovalInput['instructor']>): ApprovalInput => ({
  ...base,
  instructor: { ...base.instructor, ...over },
});

const full = { bio: 'نبذة طويلة كفاية للملف', specialties: ['قصة'] };
const state = (input: ApprovalInput, key: string) =>
  approvalSteps(input).find((s) => s.key === key)!.state;

describe('المدرب الجديد', () => {
  it('أول خطوة عليه: يكمّل ملفه', () => {
    const steps = approvalSteps(base);
    expect(steps.map((s) => s.key)).toEqual(['profile', 'training', 'exam', 'visible']);
    expect(steps[0].state).toBe('action');
    expect(steps[0].href).toBe('/dashboard/instructor/profile');
    expect(currentStep(steps)?.key).toBe('profile');
  });

  it('الخطوات اللي بعدها مقفولة لحد ما الملف يكمل', () => {
    expect(state(base, 'training')).toBe('locked');
    expect(state(base, 'exam')).toBe('locked');
    expect(state(base, 'visible')).toBe('locked');
  });

  it('ملف ناقص + طلب مستني = مستني الإدارة، مش مطلوب منه حاجة', () => {
    const input = { ...base, requests: [{ status: 'pending', requestedChanges: {} }] };
    expect(state(input, 'profile')).toBe('waiting');
  });

  /** طلب الباقات مش طلب ملف — ماينفعش يخلّي الملف «تحت المراجعة». */
  it('طلب الباقات مابيعدّيش كطلب ملف', () => {
    const input = {
      ...base,
      requests: [{ status: 'pending', requestedChanges: { _requestType: 'packages' } }],
    };
    expect(state(input, 'profile')).toBe('action');
  });
});

describe('التدريب والاختبار', () => {
  it('ملف كامل = التدريب بقى دور الإدارة', () => {
    const input = withInstructor(full);
    expect(state(input, 'profile')).toBe('done');
    expect(state(input, 'training')).toBe('waiting');
  });

  it('رابط التدريب لو الإدارة حطّته بيظهر في السطر', () => {
    const input: ApprovalInput = {
      ...withInstructor(full),
      certification: { trainingMeetingLink: 'https://meet.example.com/x' },
    };
    const step = approvalSteps(input).find((s) => s.key === 'training')!;
    expect(step.detail).toContain('رابط');
  });

  it('حضر التدريب = الاختبار بقى دور الإدارة', () => {
    const input: ApprovalInput = {
      ...withInstructor(full),
      certification: { trainingCompletedAt: '2026-10-01T10:00:00Z' },
    };
    expect(state(input, 'training')).toBe('done');
    expect(state(input, 'exam')).toBe('waiting');
  });

  /**
   * ⚠️ **أهم اختبار في الملف.** النجاح بيتقرا من `training_passed`
   *    (محميّ بمحفّز في القاعدة وهو اللي التفعيل بيعتمد عليه)، مش من
   *    `exam_passed` اللي كان المدرب يقدر يكتبه على نفسه. لو حد غيّر
   *    ده، المدرب يقدر يقنع الشاشة إنه اجتاز.
   */
  it('النجاح من training_passed، والدرجة تفصيل مش حكم', () => {
    const notPassed: ApprovalInput = {
      ...withInstructor({ ...full, trainingPassed: false }),
      certification: { trainingCompletedAt: '2026-10-01T10:00:00Z', examScore: 95 },
    };
    expect(state(notPassed, 'exam')).toBe('waiting');

    const passed: ApprovalInput = {
      ...withInstructor({ ...full, trainingPassed: true }),
      certification: { trainingCompletedAt: '2026-10-01T10:00:00Z', examScore: 95 },
    };
    const step = approvalSteps(passed).find((s) => s.key === 'exam')!;
    expect(step.state).toBe('done');
    expect(step.detail).toContain('95');
  });

  it('اجتاز بس لسه مش مفعّل = مستني الإدارة، والظهور مش done', () => {
    const input = withInstructor({ ...full, trainingPassed: true });
    expect(state(input, 'visible')).toBe('waiting');
  });
});

describe('الظهور للعملاء', () => {
  it('active = ظاهر', () => {
    const input = withInstructor({ ...full, trainingPassed: true, status: 'active' });
    expect(state(input, 'visible')).toBe('done');
    expect(approvalHeadline('active', approvalSteps(input))).toMatchObject({
      visible: true,
      tone: 'ok',
    });
  });

  /**
   * ⚠️ المخفي والموقوف **قرار إداري بعد الاعتماد** مش خطوة ناقصة.
   *    لو اتعرضوا كخطوة، المدرب بيفتكر إن عليه حاجة يعملها وهو مفيش.
   */
  it('المخفي والموقوف برّه الطريق، والشارة بتقول الحقيقة', () => {
    expect(isAdminHold('hidden')).toBe(true);
    expect(isAdminHold('suspended')).toBe(true);
    expect(isAdminHold('active')).toBe(false);
    expect(isAdminHold('pending_training')).toBe(false);

    const steps = approvalSteps(withInstructor({ ...full, trainingPassed: true }));
    expect(approvalHeadline('hidden', steps)).toMatchObject({ visible: false, tone: 'hold' });
    expect(approvalHeadline('suspended', steps)).toMatchObject({ visible: false, tone: 'hold' });
  });
});

describe('الشارة فوق', () => {
  /** دي الشارة اللي كانت مكتوبة «نشط» في الكود لكل مدرب. */
  it('مدرب لسه مكمّلش ملفه مابيشوفش «نشط»', () => {
    const headline = approvalHeadline('pending_training', approvalSteps(base));
    expect(headline.visible).toBe(false);
    expect(headline.label).not.toContain('نشط');
    expect(headline.tone).toBe('todo');
  });

  it('مستني الإدارة = «قيد الاعتماد» مش «محتاج منك خطوة»', () => {
    const steps = approvalSteps(withInstructor(full));
    expect(approvalHeadline('pending_training', steps).tone).toBe('wait');
  });

  it('مفيش حالة بتقول إنه ظاهر وهو مش active', () => {
    for (const status of ['pending_training', 'pending_approval', 'hidden', 'suspended'] as const) {
      const steps = approvalSteps(withInstructor({ ...full, status }));
      expect(approvalHeadline(status, steps).visible, status).toBe(false);
    }
  });
});
