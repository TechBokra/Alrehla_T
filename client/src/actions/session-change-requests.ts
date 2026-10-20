'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireUser } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import { parseCairoInput } from '@/lib/session-plan';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { updateSessionDetails } from '@/actions/admin-sessions';

/**
 * طلبات تغيير موعد الجلسة (ملف 16 — #LQMO، قرار تامر).
 *
 * ولي الأمر أو المدرب أو الطالب بيقترح موعد تاني بسبب، والإدارة بتبتّ:
 * الموافقة بتغيّر الموعد **من نفس الدالة اللي الإدارة بتغيّر بيها يدوي**
 * (`updateSessionDetails`) — فالإشعارات للطرفين والغرفة بيتظبطوا مرة واحدة
 * من مكان واحد.
 *
 * ⚠️ كل الدوال بترجّع ولا بترمي (قاعدة «هـ»).
 */

export type ChangeResult = { ok: true } | { ok: false; error: string; field?: string };

const fmt = (d: Date) =>
  d.toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'full', timeStyle: 'short' });

/** صاحب الجلسة بيطلب موعد تاني. */
export async function requestSessionChange(params: {
  sessionId: string;
  proposedAt: string;
  reason: string;
}): Promise<ChangeResult> {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'يجب تسجيل الدخول أولاً' };
  }

  const reason = params.reason.trim();
  if (reason.length < 3) return { ok: false, error: 'اكتب السبب عشان الإدارة تقدر تقرر', field: 'reason' };
  if (reason.length > 1000) return { ok: false, error: 'السبب طويل أوي', field: 'reason' };

  const when = parseCairoInput(params.proposedAt);
  if (!when) return { ok: false, error: 'اختار اليوم والساعة', field: 'proposedAt' };
  if (when.getTime() < Date.now() + 2 * 60 * 60 * 1000) {
    return { ok: false, error: 'الموعد الجديد لازم يكون بعد ساعتين على الأقل من دلوقتي', field: 'proposedAt' };
  }

  const supabase = await createClient();
  // ⚠️ بجلسة المستخدم: صلاحيات القاعدة هي اللي بتقول الجلسة دي تخصّه ولا لأ.
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, scheduled_at, instructor_id, course_subscription_id')
    .eq('id', params.sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: 'الجلسة مش موجودة أو مش من حقك' };
  if (session.status === 'cancelled' || session.status === 'completed') {
    return { ok: false, error: 'الجلسة دي خلصت أو اتلغت — مفيش موعد يتغيّر.' };
  }
  if (new Date(session.scheduled_at).getTime() < Date.now()) {
    return { ok: false, error: 'ميعاد الجلسة عدّى — كلّم الإدارة.' };
  }

  // مين بيطلب: المدرب المسنَد، ولا صاحب الاشتراك، ولا الطالب نفسه.
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

  const { error } = await supabase.from('session_change_requests').insert({
    session_id: session.id,
    requester_profile_id: user.id,
    requester_role: role,
    proposed_at: when.toISOString(),
    reason,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'فيه طلب تغيير للجلسة دي لسه مستني الإدارة.' };
    if (error.code === '42P01') return { ok: false, error: 'تغيير المواعيد لسه مااتفعّلش — كلّم الإدارة.' };
    console.error('requestSessionChange', error);
    return { ok: false, error: 'تعذّر إرسال الطلب — جرّب تاني' };
  }

  await notifyAdmins({
    event: 'session_update',
    title: `طلب تغيير موعد جلسة — ${user.fullName || 'مستخدم'}`,
    message: `من ${fmt(new Date(session.scheduled_at))} إلى ${fmt(when)}. السبب: ${reason}`,
    link: '/dashboard/admin/bookings/change-requests',
  });

  revalidatePath(`/dashboard/instructor/sessions/${session.id}`);
  revalidatePath(`/dashboard/student/sessions/${session.id}`);
  revalidatePath('/account/family', 'layout');
  revalidatePath('/dashboard/admin/bookings/change-requests');
  return { ok: true };
}

/** الإدارة بتوافق (الموعد بيتغيّر) أو ترفض بسبب. */
export async function decideSessionChange(params: {
  id: string;
  decision: 'approved' | 'rejected';
  note?: string;
}): Promise<ChangeResult> {
  let admin;
  try {
    admin = await requireAdmin('canManageBookings', 'غير مصرح لك بإدارة الحجوزات');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإدارة الحجوزات' };
  }
  const note = (params.note ?? '').trim();
  if (params.decision === 'rejected' && note.length < 3) {
    return { ok: false, error: 'اكتب سبب الرفض — بيوصل لصاحب الطلب', field: 'note' };
  }

  const supabase = await createClient();
  const { data: req } = await supabase
    .from('session_change_requests')
    .select('id, session_id, requester_profile_id, proposed_at, status')
    .eq('id', params.id)
    .maybeSingle();
  if (!req) return { ok: false, error: 'الطلب مش موجود' };
  if (req.status !== 'pending') return { ok: false, error: 'الطلب ده اتبتّ فيه خلاص — حدّث الصفحة' };

  if (params.decision === 'approved') {
    const { data: session } = await supabase
      .from('sessions')
      .select('meeting_url')
      .eq('id', req.session_id)
      .maybeSingle();
    // نفس مسار التعديل اليدوي: الإشعارات للطرفين، والغرفة، والسجل.
    const applied = await updateSessionDetails({
      sessionId: req.session_id,
      meetingUrl: session?.meeting_url ?? '',
      scheduledAt: req.proposed_at,
    });
    if (!applied.ok) return { ok: false, error: applied.error };
  }

  const { data: saved, error } = await supabase
    .from('session_change_requests')
    .update({
      status: params.decision,
      admin_note: note || null,
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', req.id)
    .eq('status', 'pending')
    .select('id');
  if (error || !saved || saved.length === 0) {
    console.error('decideSessionChange', error);
    return { ok: false, error: 'تعذّر حفظ القرار — حدّث الصفحة' };
  }

  if (params.decision === 'rejected') {
    await notifyUser({
      event: 'session_update',
      recipientProfileId: req.requester_profile_id,
      title: 'طلب تغيير موعد الجلسة اترفض',
      message: note,
    });
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: params.decision === 'approved' ? 'session_change_approved' : 'session_change_rejected',
    entityType: 'Session',
    entityId: req.session_id,
    metadata: { proposedAt: req.proposed_at, note: note || null },
  });

  revalidatePath('/dashboard/admin/bookings/change-requests');
  return { ok: true };
}

/** نفس `decideSessionChange` من نموذج (`ActionForm` في شاشة الإدارة). */
export async function decideSessionChangeForm(formData: FormData): Promise<ChangeResult> {
  const decision = String(formData.get('decision') ?? '');
  if (decision !== 'approved' && decision !== 'rejected') return { ok: false, error: 'القرار غير معروف' };
  return decideSessionChange({
    id: String(formData.get('id') ?? ''),
    decision,
    note: String(formData.get('note') ?? ''),
  });
}
