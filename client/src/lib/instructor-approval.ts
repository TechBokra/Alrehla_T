import type { InstructorStatus } from '@/types';
import { isProfileComplete } from '@/lib/instructor-onboarding';

/**
 * طريق المدرب لحد ما يظهر للعملاء — **بلا شاشة ولا قاعدة**.
 *
 * ── المشكلة اللي الملف ده بيحلّها ───────────────────────────
 *
 * المدرب الجديد بيدخل لوحته ويلاقي **شارة خضرا مكتوب فيها «نشط»** —
 * وهو مش ظاهر لولا عميل واحد، وحالته `pending_training`، ومفيش في
 * الشاشة كلها سطر واحد بيقول له المطلوب منه إيه. يفضل مستني حدًّا
 * يكلّمه، والإدارة فاكرة إنها بلّغته.
 *
 * (بالقياس على القاعدة وقت كتابة الملف: ٥ مدربين، **٣ منهم**
 * `pending_training` ومالهمش ولا صف اعتماد.)
 *
 * ── أهم قرار هنا ────────────────────────────────────────────
 *
 * ⚠️ **«اجتاز الاختبار» بتتقرا من `instructors.training_passed`
 *    وحده — لا من `instructor_certifications.exam_passed`.**
 *
 *    السببين:
 *      • `training_passed` محميّ بمحفّز في القاعدة
 *        (`guard_instructor_fields`) بيرجّع أي تعديل من غير إداري،
 *        **وهو اللي دالة التفعيل بتقرا منه**. يعني هو الحقيقة.
 *      • `exam_passed` كان مفتوحًا للمدرب يكتبه على نفسه (اتقفل في
 *        هجرة `20261017235000`). وحتى بعد ما اتقفل، فضّلنا نقرا من
 *        العمود اللي التفعيل بيعتمد عليه — عشان الشاشة تقول نفس
 *        اللي النظام شايفه، مش حاجة قريبة منه.
 *
 *    والدرجة (`examScore`) بتتعرض كتفصيل، ومابتحدّدش النجاح أبدًا.
 */

/** حالة الخطوة الواحدة. */
export type StepState =
  /** خلصت. */
  | 'done'
  /** دور المدرب — عليه هو يعمل حاجة. */
  | 'action'
  /** دور الإدارة — مستني. */
  | 'waiting'
  /** لسه مجّا دورها (اللي قبلها ما خلصتش). */
  | 'locked';

export type ApprovalStep = {
  key: 'profile' | 'training' | 'exam' | 'visible';
  title: string;
  state: StepState;
  /** سطر بيقول إيه اللي حصل أو المطلوب — بصيغة المخاطَب. */
  detail: string;
  /** لينك يودّيه للخطوة لو دوره. */
  href?: string;
  hrefLabel?: string;
};

export type ApprovalInput = {
  instructor: {
    status: InstructorStatus;
    trainingPassed: boolean;
    bio?: string | null;
    specialties?: string[] | null;
  };
  certification: {
    trainingCompletedAt?: string | null;
    trainingMeetingLink?: string | null;
    examScore?: number | null;
  } | null;
  /** طلبات تعديل الملف — عشان نفرّق «ناقص» من «مستني مراجعة». */
  requests: { status: string; requestedChanges?: Record<string, unknown> | null }[];
};

/**
 * ⚠️ **الحالتين دول مش جزء من الطريق** — دول قرار إداري بعد
 *    الاعتماد: المدرب معتمد وشغله مستمر، بس مش معروض للعملاء.
 *    عرضهم كـ«خطوة ناقصة» بيخلّي المدرب يفتكر إن فيه حاجة عليه
 *    يعملها وهو مفيش.
 */
export function isAdminHold(status: InstructorStatus): boolean {
  return status === 'hidden' || status === 'suspended';
}

const PROFILE_HREF = '/dashboard/instructor/profile';

export function approvalSteps(input: ApprovalInput): ApprovalStep[] {
  const { instructor, certification, requests } = input;

  const profileDone = isProfileComplete(instructor);
  const profileInReview = requests.some(
    (r) =>
      r.status === 'pending' &&
      (r.requestedChanges as { _requestType?: string } | null)?._requestType !== 'packages',
  );

  // ⚠️ من `training_passed` لا من `exam_passed` — اقرا رأس الملف.
  const examDone = instructor.trainingPassed === true;

  /* ⚠️ **اجتياز الاختبار بيعني إن التدريب حصل.**
   *
   *    الإدارة ممكن تسجّل النتيجة من غير ما تكون كتبت تاريخ التدريب
   *    (الزرار القديم كان بيكتب `exam_passed` وبس). من غير السطر ده،
   *    المدرب كان هيشوف «الاختبار: تمّت» وفوقها «التدريب: على
   *    الإدارة» — ترتيب بيخلّي اللوحة تبان بايظة، والمدرب يسأل عن
   *    تدريب هو حضره فعلًا. */
  const trainingDone = Boolean(certification?.trainingCompletedAt) || examDone;
  const visible = instructor.status === 'active';

  const profile: ApprovalStep = profileDone
    ? { key: 'profile', title: 'ملفك', state: 'done', detail: 'ملفك مكتمل.' }
    : profileInReview
      ? {
          key: 'profile',
          title: 'ملفك',
          state: 'waiting',
          detail: 'ملفك عند الإدارة للمراجعة.',
        }
      : {
          key: 'profile',
          title: 'ملفك',
          state: 'action',
          detail: 'كمّل صورتك ونبذتك وتخصصاتك — دي اللي الأهالي بيشوفوها.',
          href: PROFILE_HREF,
          hrefLabel: 'كمّل ملفك',
        };

  const training: ApprovalStep = trainingDone
    ? { key: 'training', title: 'التدريب', state: 'done', detail: 'حضرت التدريب.' }
    : {
        key: 'training',
        title: 'التدريب',
        state: profileDone ? 'waiting' : 'locked',
        detail: profileDone
          ? certification?.trainingMeetingLink
            ? 'الإدارة حدّدت لك رابط التدريب — تحته.'
            : 'الإدارة هي اللي بتحدّد معادك، وهتتواصل معاك. ولو اتأخّرت، كلّمنا من الدعم.'
          : 'بيبدأ بعد ما تكمّل ملفك.',
      };

  const exam: ApprovalStep = examDone
    ? {
        key: 'exam',
        title: 'الاختبار',
        state: 'done',
        detail:
          typeof certification?.examScore === 'number'
            ? `اجتزت الاختبار بدرجة ${certification.examScore}.`
            : 'اجتزت الاختبار.',
      }
    : {
        key: 'exam',
        title: 'الاختبار',
        state: trainingDone ? 'waiting' : 'locked',
        detail: trainingDone
          ? 'الإدارة بتسجّل نتيجتك بعد الاختبار.'
          : 'بيجي بعد التدريب.',
      };

  const visibleStep: ApprovalStep = visible
    ? {
        key: 'visible',
        title: 'ظاهر للعملاء',
        state: 'done',
        detail: 'ملفك ظاهر في صفحة المدربين، والأهالي يقدروا يحجزوا معاك.',
      }
    : {
        key: 'visible',
        title: 'ظاهر للعملاء',
        state: examDone ? 'waiting' : 'locked',
        detail: examDone
          ? 'فاضل تفعيل الإدارة — بعده ملفك يظهر في صفحة المدربين على طول.'
          : 'بيحصل بعد اجتياز التدريب والاختبار.',
      };

  return [profile, training, exam, visibleStep];
}

/** الخطوة اللي الطريق واقف عندها — أول واحدة مش `done`. */
export function currentStep(steps: ApprovalStep[]): ApprovalStep | null {
  return steps.find((s) => s.state !== 'done') ?? null;
}

/**
 * سطر واحد فوق في الصفحة.
 *
 * ⚠️ **الشارة كانت مكتوبة «نشط» بالأحرف في الكود** لكل مدرب، مهما
 *    كانت حالته. مدرب مش ظاهر لحد كان بيقرا إنه نشط — ودي مش شارة
 *    غلط، دي معلومة بتمنعه إنه يسأل.
 */
export type ApprovalHeadline = {
  label: string;
  tone: 'ok' | 'wait' | 'todo' | 'hold';
  /** مرئي للعملاء دلوقتي؟ */
  visible: boolean;
};

export function approvalHeadline(
  status: InstructorStatus,
  steps: ApprovalStep[],
): ApprovalHeadline {
  if (status === 'suspended') {
    return { label: 'موقوف مؤقتًا', tone: 'hold', visible: false };
  }
  if (status === 'hidden') {
    return { label: 'معتمد — مخفي من الموقع', tone: 'hold', visible: false };
  }
  if (status === 'active') {
    return { label: 'ظاهر للعملاء', tone: 'ok', visible: true };
  }
  const step = currentStep(steps);
  if (step?.state === 'action') {
    return { label: 'محتاج منك خطوة', tone: 'todo', visible: false };
  }
  return { label: 'قيد الاعتماد', tone: 'wait', visible: false };
}
