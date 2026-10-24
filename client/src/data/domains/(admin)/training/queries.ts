import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  FOUNDATION_COURSE_ID,
  readProgress,
  type CourseContent,
  type LearnerCourse,
  type TrainingProgress,
} from '@/lib/training';

/**
 * التأهيل التأسيسي — القراءة.
 *
 * ⚠️ المدرب مابيقراش `training_courses` (فيها الإجابات) — بياخد المحتوى
 *    من `training_course_for_me` اللي بتشيلها. الإدارة بتقرا الجدول.
 * ⚠️ لو ترحيل `20261025120000` لسه ماتشغّلش، كل حاجة بترجّع `null`/فاضي
 *    والشاشات بتقول «التأهيل لسه مش مفعّل».
 */

function missing(code: string | undefined): boolean {
  return code === 'PGRST202' || code === 'PGRST205' || code === '42P01' || code === '42883';
}

export type TrainingLoad<T> = { state: 'ok'; data: T } | { state: 'not_set_up' } | { state: 'error'; error: string };

export async function getLearnerCourse(courseId = FOUNDATION_COURSE_ID): Promise<TrainingLoad<LearnerCourse | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('training_course_for_me', { p_course: courseId });
  if (error) {
    if (missing(error.code)) return { state: 'not_set_up' };
    console.error('Error loading training course', error);
    return { state: 'error', error: error.message || 'تعذّر تحميل التأهيل.' };
  }
  if (!data) return { state: 'ok', data: null };
  const raw = data as unknown as LearnerCourse & { progress: unknown };
  return { state: 'ok', data: { ...raw, progress: readProgress(raw.progress) } };
}

export type AdminCourse = {
  id: string;
  title: string;
  version: string;
  content: CourseContent;
  modulePassPct: number;
  finalPassPct: number;
  criticalRequired: boolean;
  requiredForActivation: boolean;
  isActive: boolean;
  updatedAt: string;
};

export async function getAdminCourse(courseId = FOUNDATION_COURSE_ID): Promise<TrainingLoad<AdminCourse | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('training_courses').select('*').eq('id', courseId).maybeSingle();
  if (error) {
    if (missing(error.code)) return { state: 'not_set_up' };
    console.error('Error loading training course (admin)', error);
    return { state: 'error', error: 'تعذّر تحميل الدورة.' };
  }
  if (!data) return { state: 'ok', data: null };
  return {
    state: 'ok',
    data: {
      id: data.id,
      title: data.title,
      version: data.version,
      content: data.content as unknown as CourseContent,
      modulePassPct: data.module_pass_pct,
      finalPassPct: data.final_pass_pct,
      criticalRequired: data.critical_required,
      requiredForActivation: data.required_for_activation,
      isActive: data.is_active,
      updatedAt: data.updated_at,
    },
  };
}

export type FinalAttempt = {
  id: string;
  courseVersion: string;
  score: number;
  correct: number;
  total: number;
  criticalCorrect: number;
  criticalTotal: number;
  passed: boolean;
  submittedAt: string;
};

export type LearnerRecord = {
  userId: string;
  progress: TrainingProgress | null;
  resetAt: string | null;
  attempts: FinalAttempt[];
};

/** تقدّم مدربين معيّنين (أو الكل) — للإدارة. */
export async function getTrainingRecords(
  userIds: string[] | null,
  courseId = FOUNDATION_COURSE_ID,
): Promise<Map<string, LearnerRecord>> {
  const out = new Map<string, LearnerRecord>();
  if (userIds && userIds.length === 0) return out;
  const supabase = await createClient();

  let pq = supabase.from('training_progress').select('*').eq('course_id', courseId);
  let aq = supabase
    .from('training_final_attempts')
    .select('id, user_id, course_version, score, correct, total, critical_correct, critical_total, passed, submitted_at')
    .eq('course_id', courseId)
    .order('submitted_at', { ascending: false })
    .limit(2000);
  if (userIds) {
    pq = pq.in('user_id', userIds);
    aq = aq.in('user_id', userIds);
  }
  const [{ data: progress, error: pe }, { data: attempts, error: ae }] = await Promise.all([pq, aq]);
  if (pe && !missing(pe.code)) console.error('Error reading training progress', pe);
  if (ae && !missing(ae.code)) console.error('Error reading training attempts', ae);

  for (const p of progress ?? []) {
    out.set(p.user_id, { userId: p.user_id, progress: readProgress(p), resetAt: p.reset_at, attempts: [] });
  }
  for (const a of attempts ?? []) {
    const rec = out.get(a.user_id) ?? { userId: a.user_id, progress: null, resetAt: null, attempts: [] };
    rec.attempts.push({
      id: a.id,
      courseVersion: a.course_version,
      score: a.score,
      correct: a.correct,
      total: a.total,
      criticalCorrect: a.critical_correct,
      criticalTotal: a.critical_total,
      passed: a.passed,
      submittedAt: a.submitted_at,
    });
    out.set(a.user_id, rec);
  }
  return out;
}

/** الدورة إلزامية قبل التفعيل؟ ومين اجتازها؟ — لحارس التفعيل. */
export async function activationTrainingCheck(
  userId: string | null,
  courseId = FOUNDATION_COURSE_ID,
): Promise<{ required: boolean; passed: boolean }> {
  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from('training_courses')
    .select('required_for_activation, is_active')
    .eq('id', courseId)
    .maybeSingle();
  if (error || !course || !course.is_active || !course.required_for_activation) {
    return { required: false, passed: false };
  }
  if (!userId) return { required: true, passed: false };
  const { data: p } = await supabase
    .from('training_progress')
    .select('passed_at')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();
  return { required: true, passed: Boolean(p?.passed_at) };
}
