'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, requireAdmin } from '@/lib/auth-guard';
import { notifyAdmins } from '@/lib/notifications';
import { logAuditAction } from '@/lib/audit';
import { FOUNDATION_COURSE_ID, validateContent, type FinalResult, type ModuleResult } from '@/lib/training';

/**
 * التأهيل التأسيسي — الأكشنز.
 *
 * ⚠️ **بترجّع ولا بترمي** (قاعدة «هـ»). والتصحيح كله في القاعدة: الأكشن
 *    بيبعت اختيارات المدرب وبس، ومابيعرفش الإجابة الصحيحة.
 */

type Fail = { ok: false; error: string };

const errMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const NOT_SET_UP = 'التأهيل محتاج تحديث القاعدة (ترحيل 20261025120000).';
const missing = (code?: string) => code === 'PGRST202' || code === '42883' || code === '42P01';

function answersOk(answers: unknown): answers is number[] {
  return Array.isArray(answers) && answers.length <= 200 && answers.every((a) => Number.isInteger(a) && a >= 0 && a < 20);
}

// ══ المدرب ═════════════════════════════════════════════════════

export async function startTraining(courseId = FOUNDATION_COURSE_ID): Promise<{ ok: true } | Fail> {
  try {
    await requireUser();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'لازم تسجّل الدخول') };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('training_start', { p_course: courseId });
  if (error) return { ok: false, error: missing(error.code) ? NOT_SET_UP : error.message };
  return { ok: true };
}

/** وقت الدراسة — القاعدة بتحدّه (دقيقتين للنداء، ومش أكتر من اللي عدّى). */
export async function trainingHeartbeat(seconds: number, courseId = FOUNDATION_COURSE_ID): Promise<void> {
  try {
    await requireUser();
    const supabase = await createClient();
    await supabase.rpc('training_heartbeat', {
      p_course: courseId,
      p_seconds: Math.max(0, Math.min(120, Math.round(seconds) || 0)),
    });
  } catch {
    /* الوقت تقديري — فشله مايوقفش الدراسة */
  }
}

export async function submitTrainingModule(
  moduleIndex: number,
  answers: number[],
  courseId = FOUNDATION_COURSE_ID,
): Promise<({ ok: true } & ModuleResult) | Fail> {
  try {
    await requireUser();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'لازم تسجّل الدخول') };
  }
  if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || !answersOk(answers)) {
    return { ok: false, error: 'إجابات غير مفهومة — أعد تحميل الصفحة.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('training_submit_module', {
    p_course: courseId,
    p_module: moduleIndex,
    p_answers: answers,
  });
  if (error) return { ok: false, error: missing(error.code) ? NOT_SET_UP : error.message || 'تعذّر التصحيح.' };
  revalidatePath('/dashboard/instructor/training');
  return { ok: true, ...(data as unknown as ModuleResult) };
}

export async function submitTrainingFinal(
  answers: number[],
  courseId = FOUNDATION_COURSE_ID,
): Promise<({ ok: true } & FinalResult) | Fail> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'لازم تسجّل الدخول') };
  }
  if (!answersOk(answers)) return { ok: false, error: 'إجابات غير مفهومة — أعد تحميل الصفحة.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('training_submit_final', { p_course: courseId, p_answers: answers });
  if (error) return { ok: false, error: missing(error.code) ? NOT_SET_UP : error.message || 'تعذّر التصحيح.' };
  const result = data as unknown as FinalResult;

  if (result.attemptId) {
    await logAuditAction({
      actorProfileId: user.id,
      actorName: user.fullName,
      action: result.passed ? 'training_final_passed' : 'training_final_failed',
      entityType: 'TrainingAttempt',
      entityId: result.attemptId,
      metadata: { courseId, score: result.score, critical: `${result.criticalCorrect}/${result.criticalTotal}` },
    });
    // ⚠️ بدل الإيميل اليدوي في الملف القديم: الإدارة بتعرف أول ما ينجح.
    if (result.passed) {
      await notifyAdmins({
        title: `${user.fullName || 'مدرب'} اجتاز التأهيل التأسيسي`,
        message: `بدرجة ${result.score}٪ — راجع ملفه وحدّد التدريب العملي.`,
        link: '/dashboard/admin/instructors/training',
        event: 'instructor_profile',
      });
    }
  }

  revalidatePath('/dashboard/instructor/training');
  revalidatePath('/dashboard/instructor');
  return { ok: true, ...result };
}

// ══ الإدارة ════════════════════════════════════════════════════

async function admin() {
  return requireAdmin('canManageInstructors', 'إدارة التأهيل لإدارة المدربين');
}

export async function saveTrainingSettings(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  let user;
  try {
    user = await admin();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'غير مصرح') };
  }
  const pct = (name: string) => {
    const n = Number(formData.get(name));
    return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
  };
  const modulePass = pct('modulePassPct');
  const finalPass = pct('finalPassPct');
  if (modulePass === null) return { ok: false, error: 'نسبة من ١ لـ ١٠٠.', field: 'modulePassPct' };
  if (finalPass === null) return { ok: false, error: 'نسبة من ١ لـ ١٠٠.', field: 'finalPassPct' };
  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3 || title.length > 200) return { ok: false, error: 'اكتب اسم الدورة.', field: 'title' };

  const num = (name: string, min: number, max: number) => {
    const n = Number(formData.get(name));
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const estimateMin = num('estimateMin', 1, 1000);
  const estimateMax = num('estimateMax', 1, 1000);
  const idleMinutes = num('idleMinutes', 1, 60);
  if (estimateMin === null) return { ok: false, error: 'رقم دقايق صحيح.', field: 'estimateMin' };
  if (estimateMax === null || estimateMax < estimateMin) {
    return { ok: false, error: 'لازم يبقى أكبر من أو يساوي «من».', field: 'estimateMax' };
  }
  if (idleMinutes === null) return { ok: false, error: 'من ١ لـ ٦٠ دقيقة.', field: 'idleMinutes' };

  // ربط المجالات بالوحدات — من الخانات `tm_<مجال>_<وحدة>` وأسماء المجالات
  // من القاعدة (مش من المتصفح).
  const supabase = await createClient();
  const { data: current } = await supabase
    .from('training_courses')
    .select('content')
    .eq('id', FOUNDATION_COURSE_ID)
    .maybeSingle();
  const content = (current?.content ?? {}) as { topics?: unknown; modules?: unknown[] };
  const topics = Array.isArray(content.topics) ? content.topics.filter((t): t is string => typeof t === 'string') : [];
  const moduleCount = Array.isArray(content.modules) ? content.modules.length : 0;
  const topicModules: Record<string, number[]> = {};
  topics.forEach((t, ti) => {
    topicModules[t] = Array.from({ length: moduleCount }, (_, mi) => mi).filter(
      (mi) => formData.get(`tm_${ti}_${mi}`) === 'on',
    );
  });

  const patch = {
    title,
    module_pass_pct: modulePass,
    final_pass_pct: finalPass,
    critical_required: formData.get('criticalRequired') === 'on',
    required_for_activation: formData.get('requiredForActivation') === 'on',
    is_active: formData.get('isActive') === 'on',
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const extra = {
    estimate_min_minutes: estimateMin,
    estimate_max_minutes: estimateMax,
    idle_minutes: idleMinutes,
    topic_modules: topicModules,
  };
  let { data, error } = await supabase
    .from('training_courses')
    .update({ ...patch, ...extra })
    .eq('id', FOUNDATION_COURSE_ID)
    .select('id')
    .maybeSingle();
  // ⚠️ قبل ترحيل 20261027090000 الأعمدة الجديدة مش موجودة — نحفظ الباقي ونقول.
  let partial = false;
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    partial = true;
    ({ data, error } = await supabase
      .from('training_courses')
      .update(patch)
      .eq('id', FOUNDATION_COURSE_ID)
      .select('id')
      .maybeSingle());
  }
  if (error) return { ok: false, error: missing(error.code) ? NOT_SET_UP : 'تعذّر الحفظ.' };
  if (!data) return { ok: false, error: 'الحفظ ماوصلش للقاعدة — راجع الصلاحيات.' };
  if (partial) {
    return { ok: false, error: 'اتحفظ النجاح والتفعيل بس — الوقت وربط المجالات محتاجين ترحيل 20261027090000.' };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'training_settings_updated',
    entityType: 'TrainingCourse',
    entityId: FOUNDATION_COURSE_ID,
    metadata: { ...patch, ...extra },
  });
  revalidatePath('/dashboard/admin/instructors/training');
  revalidatePath('/dashboard/instructor/training');
  return { ok: true };
}

/**
 * نسخة جديدة من محتوى الدورة (من ملف HTML اتقرا في المتصفح).
 *
 * ⚠️ بيتتحقق تاني هنا — اللي جاي من المتصفح مش مضمون (قاعدة «ف»).
 * ⚠️ التقدّم القديم مابيتمسحش: الوحدات اللي خلصت بتفضل، والاجتياز
 *    بيفضل. لو النسخة الجديدة محتاجة إعادة، الإدارة بتعيد لكل مدرب.
 */
export async function importTrainingContent(params: {
  content: unknown;
  version: string;
}): Promise<{ ok: true } | Fail> {
  let user;
  try {
    user = await admin();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'غير مصرح') };
  }
  const version = String(params.version ?? '').trim();
  if (!version || version.length > 40) return { ok: false, error: 'اكتب رقم الإصدار.' };
  const checked = validateContent(params.content);
  if (!checked.ok) return checked;
  if (JSON.stringify(checked.content).length > 1_000_000) return { ok: false, error: 'المحتوى أكبر من المسموح.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('training_courses')
    .update({
      content: checked.content as never,
      version,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', FOUNDATION_COURSE_ID)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: missing(error.code) ? NOT_SET_UP : 'تعذّر حفظ المحتوى.' };
  if (!data) return { ok: false, error: 'الحفظ ماوصلش للقاعدة — راجع الصلاحيات.' };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'training_content_imported',
    entityType: 'TrainingCourse',
    entityId: FOUNDATION_COURSE_ID,
    metadata: {
      version,
      modules: checked.content.modules.length,
      finalQuestions: checked.content.finalQuestions.length,
    },
  });
  revalidatePath('/dashboard/admin/instructors/training');
  revalidatePath('/dashboard/instructor/training');
  return { ok: true };
}

/** إعادة التأهيل لمدرب — المحاولات القديمة بتفضل في السجل. */
export async function resetTrainingProgress(userId: string, instructorId?: string): Promise<{ ok: true } | Fail> {
  let user;
  try {
    user = await admin();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'غير مصرح') };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('training_reset_progress', { p_user: userId, p_course: FOUNDATION_COURSE_ID });
  if (error) return { ok: false, error: missing(error.code) ? NOT_SET_UP : error.message || 'تعذّر الإعادة.' };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'training_progress_reset',
    entityType: 'TrainingProgress',
    entityId: userId,
    metadata: { instructorId: instructorId ?? null },
  });
  revalidatePath('/dashboard/admin/instructors/training');
  if (instructorId) revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  return { ok: true };
}
