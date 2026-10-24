'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireUser } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import { categoryLabel, validateIncident, type IncidentStatus } from '@/lib/incidents';

/**
 * بلاغات الجلسات (قرار ٢٤ أكتوبر، بند ١١).
 *
 * ⚠️ كل الدوال بترجّع ولا بترمي (قاعدة «هـ»).
 */

export type IncidentResult = { ok: true } | { ok: false; error: string; field?: string };

const NOT_READY = 'البلاغات لسه بتتجهّز. لو الموقف عاجل، كلّم الإدارة من الدعم دلوقتي.';
const ADMIN_LINK = '/dashboard/admin/sessions/incidents';

function missingTable(e: { code?: string; message?: string } | null): boolean {
  return Boolean(e && (e.code === '42P01' || /session_incidents/.test(e.message ?? '')));
}

/** المدرب أو الطالب أو ولي الأمر بيبلّغ عن مشكلة في جلسة. */
export async function reportIncident(params: {
  sessionId: string;
  category: string;
  severity: string;
  description: string;
}): Promise<IncidentResult> {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'يجب تسجيل الدخول أولاً' };
  }

  const checked = validateIncident(params);
  if (!checked.ok) return { ok: false, error: checked.error, field: checked.field };

  const supabase = await createClient();
  // ⚠️ بجلسة المستخدم: صلاحيات `sessions` بتوري الأطراف بس — فلو
  //    الجلسة مش ظاهرة له، هو مش طرف فيها.
  const { data: session } = await supabase
    .from('sessions')
    .select('id, session_number, instructor_id, course_subscription_id')
    .eq('id', params.sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: 'الجلسة مش موجودة أو مش من حقك' };

  let role: 'instructor' | 'guardian' | 'student' = 'student';
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (instructor && instructor.id === session.instructor_id) role = 'instructor';
  else {
    const { data: sub } = await supabase
      .from('course_subscriptions')
      .select('user_id')
      .eq('id', session.course_subscription_id)
      .maybeSingle();
    if (sub?.user_id === user.id && user.role !== 'student') role = 'guardian';
  }

  const { error } = await supabase.from('session_incidents' as never).insert({
    session_id: session.id,
    course_subscription_id: session.course_subscription_id,
    reporter_profile_id: user.id,
    reporter_role: role,
    severity: checked.severity,
    category: checked.category,
    description: checked.description,
  } as never);

  if (error) {
    if (missingTable(error)) return { ok: false, error: NOT_READY };
    console.error('reportIncident', error);
    return { ok: false, error: 'تعذّر إرسال البلاغ — جرّب تاني، ولو عاجل كلّم الإدارة من الدعم.' };
  }

  const who = role === 'instructor' ? 'المدرب' : role === 'guardian' ? 'ولي الأمر' : 'الطالب';
  await notifyAdmins({
    title:
      checked.severity === 'urgent'
        ? `🚨 بلاغ عاجل — ${categoryLabel(checked.category)}`
        : `بلاغ عن جلسة — ${categoryLabel(checked.category)}`,
    message: `${who} (${user.fullName || '—'}) · الجلسة ${session.session_number}: ${checked.description.slice(0, 300)}`,
    link: ADMIN_LINK,
  });

  await logAuditAction({
    actorProfileId: user.id,
    action: 'session_incident_reported',
    entityType: 'Session',
    entityId: session.id,
    metadata: { severity: checked.severity, category: checked.category, role },
  });

  revalidatePath(ADMIN_LINK);
  revalidatePath('/dashboard/admin');
  return { ok: true };
}

/** الإدارة: تمسك البلاغ، تغيّر حالته، تكتب القرار. */
export async function updateIncident(formData: FormData): Promise<IncidentResult> {
  let admin;
  try {
    admin = await requireAdmin('canManageBookings');
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح' };
  }

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as IncidentStatus;
  const adminNote = String(formData.get('adminNote') ?? '').trim() || null;
  const resolution = String(formData.get('resolution') ?? '').trim() || null;

  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return { ok: false, error: 'الحالة غير معروفة', field: 'status' };
  }
  if (status === 'resolved' && (!resolution || resolution.length < 5)) {
    return { ok: false, error: 'اكتب القرار قبل ما تقفل البلاغ — بيوصل لصاحبه', field: 'resolution' };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('session_incidents' as never)
    .select('reporter_profile_id, status, assigned_to')
    .eq('id', id)
    .maybeSingle();
  const prev = before as { reporter_profile_id: string; status: string; assigned_to: string | null } | null;
  if (!prev) return { ok: false, error: 'البلاغ مش موجود' };

  const now = new Date().toISOString();
  const { data: saved, error } = await supabase
    .from('session_incidents' as never)
    .update({
      status,
      admin_note: adminNote,
      resolution,
      // اللي بيحرّك البلاغ من «جديد» هو اللي ماسكه، لو محدّش ماسكه.
      assigned_to: prev.assigned_to ?? admin.id,
      updated_at: now,
      resolved_at: status === 'resolved' ? now : null,
    } as never)
    .eq('id', id)
    .select('id');
  if (error || !saved || (saved as unknown[]).length === 0) {
    console.error('updateIncident', error);
    return { ok: false, error: 'تعذّر الحفظ — حدّث الصفحة' };
  }

  if (status === 'resolved' && prev.status !== 'resolved') {
    await notifyUser({
      recipientProfileId: prev.reporter_profile_id,
      title: 'البلاغ اللي بعته اتقفل',
      message: resolution ?? undefined,
    });
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'session_incident_updated',
    entityType: 'SessionIncident',
    entityId: id,
    metadata: { from: prev.status, to: status },
  });

  revalidatePath(ADMIN_LINK);
  revalidatePath('/dashboard/admin');
  return { ok: true };
}
