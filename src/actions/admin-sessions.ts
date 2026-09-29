'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { notifyUser, getInstructorUserId } from '@/lib/notifications';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { checkScheduleTime, parseCairoInput } from '@/lib/session-plan';
import { getSubscriptionSessionPlan } from '@/data/domains/session-admin';
import { getSiteSettings } from '@/data/domains/content';
import { createSessionRoom, isDailyConfigured } from '@/lib/daily';

/**
 * The session's meeting room and its time.
 *
 * The `meeting_url` column was added so the dashboards could stop linking
 * everybody to Google Meet's home page — but nothing could write to it, so
 * every session showed "رابط الجلسة لم يُضَف بعد" with no way to add one.
 */
/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireBookingsAdmin() {
  return requireAdmin('canManageBookings', 'غير مصرح لك بإدارة الجلسات');
}

export type CreateSessionResult =
  | { ok: true; sessionId: string; sessionNumber: number; roomReady: boolean }
  | { ok: false; error: string };

/**
 * إنشاء جلسة لاشتراك قائم.
 *
 * ── ليه الدالة دي موجودة ────────────────────────────────────
 *
 * الجلسات كانت بتتولّد من حتة واحدة: تأكيد دفع الحجز. يعني جلسة
 * اتلغت، أو المدرب غاب، أو اتفقوا على موعد إضافي — **مفيش طريقة**،
 * والحل الوحيد حجز جديد يعني دفعة جديدة.
 *
 * ── والكتابة `INSERT` عادي، مش دالة ─────────────────────────
 *
 * التشخيص 115 أثبت إن سياسة الإدراج على `sessions` **بتسمح
 * للإدارة خلاص**. فمفيش فجوة صلاحيات تتقفل بدالة `SECURITY
 * DEFINER` — والدالة كانت هتبقى طبقة زيادة بتخفي السياسة الحقيقية.
 *
 * ⚠️ **ورقم الجلسة بيتحسب هنا، والقاعدة هي اللي بتحرسه.** الحساب
 *    في الكود مش ذرّي: إداريان بيضيفوا في نفس اللحظة بيقروا نفس
 *    أكبر رقم. قيد التفرّد (ملف 116) بيحوّل الحالة دي من **رقمين
 *    متكررين في لوحة الطالب** — وده بيعدّي صامتًا — إلى خطأ
 *    والدالة بتعيد المحاولة مرة.
 */
export async function createSessionForSubscription(params: {
  subscriptionId: string;
  /** نص خانة `datetime-local` — **بيتقرا كساعة حيطة في القاهرة**. */
  scheduledAt: string;
  instructorId: string | null;
  reason: string;
}): Promise<CreateSessionResult> {
  let admin;
  try {
    admin = await requireBookingsAdmin();
  } catch {
    return { ok: false, error: 'غير مصرح لك بإدارة الجلسات' };
  }

  const when = checkScheduleTime(params.scheduledAt);
  if (!when.ok) return { ok: false, error: when.error };

  const supabase = await createClient();

  const plan = await getSubscriptionSessionPlan(params.subscriptionId);
  if (!plan) return { ok: false, error: 'الاشتراك مش موجود أو مش من حقك.' };

  // ⚠️ **السبب مطلوب للجلسة الزيادة.** الجلسة بعد عدد الباقة جلسة
  //    ببلاش — واردة تمامًا كتعويض، ومستحيلة بالغلط. الشرط هنا لا
  //    في الشاشة، لأن الأكشن ممكن يتنادى من غيرها (قاعدة «ع»).
  const reason = params.reason.trim();
  if (plan.quota.isExtra && reason.length < 3) {
    return {
      ok: false,
      error: 'دي جلسة زيادة عن عدد الباقة — اكتب السبب قبل ما تكمّل.',
    };
  }

  // ⚠️ **محاولتان لا واحدة.** لو إداري تاني سبقنا بالرقم ده، القيد
  //    في القاعدة بيرفض (23505) — بنقرا أكبر رقم من الأول ونعيد.
  //    التانية بتفشل تفشل، وساعتها الرسالة بتقول السبب.
  let row: { id: string; session_number: number } | null = null;
  let lastError: { code?: string } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const fresh = attempt === 0 ? plan : await getSubscriptionSessionPlan(params.subscriptionId);
    if (!fresh) return { ok: false, error: 'الاشتراك مش موجود أو مش من حقك.' };

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        course_subscription_id: params.subscriptionId,
        instructor_id: params.instructorId,
        session_number: fresh.nextNumber,
        scheduled_at: when.at.toISOString(),
        // ⚠️ **`scheduled` لا `pending`.** الموعد هنا محدَّد بإيد
        //    الإدارة، و`pending` الشاشة بتترجمها «بانتظار تثبيت
        //    الموعد» — فكانت هتقول لولي الأمر عكس اللي حصل.
        status: 'scheduled',
      })
      // ⚠️ بـ`select()`: الكتابة على صفر صفوف بتنجح في صمت (قاعدة «و»).
      .select('id, session_number')
      .maybeSingle();

    if (data) {
      row = data;
      break;
    }
    lastError = error;
    if (error?.code !== '23505') break;
  }

  if (!row) {
    console.error('Error creating session', lastError);
    return {
      ok: false,
      error:
        lastError?.code === '23505'
          ? 'رقم الجلسة اتاخد دلوقتي من حد تاني. حدّث الصفحة وجرّب تاني.'
          : 'الجلسة ما اتعملتش. حدّث الصفحة وجرّب تاني.',
    };
  }

  // ── الغرفة ───────────────────────────────────────────────
  //
  // ⚠️ **فشل الغرفة مايلغيش الجلسة.** الجلسة اتسجّلت والإشعارات
  //    هتتبعت؛ غرفة ناقصة بتتصلّح بزرّ «جهّز غرف الجلسات القادمة».
  //    إلغاء الجلسة عشان نداء شبكة فشل بيضيّع اللي نجح.
  let roomReady = false;
  if (isDailyConfigured()) {
    const settings = await getSiteSettings();
    const room = await createSessionRoom({
      sessionId: row.id,
      startsAt: when.at,
      durationMinutes: 40,
      recordingEnabled: settings.sessionRecording.enabled,
    });

    if (room.ok) {
      const { data: saved } = await supabase
        .from('sessions')
        .update({
          room_name: room.data.name,
          room_url: room.data.url,
          recording_status: settings.sessionRecording.enabled ? 'pending' : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .select('id');
      roomReady = Boolean(saved && saved.length > 0);
    }
  }

  // ── مين يعرف ─────────────────────────────────────────────
  const whenLabel = when.at.toLocaleString('ar-EG', {
    timeZone: PLATFORM_TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  });

  if (params.instructorId) {
    await notifyUser({
      event: 'session_update',
      recipientProfileId: await getInstructorUserId(params.instructorId),
      title: 'جلسة جديدة في جدولك',
      message: whenLabel,
      link: `/dashboard/instructor/sessions/${row.id}`,
    });
  }

  const { data: sub } = await supabase
    .from('course_subscriptions')
    .select('user_id')
    .eq('id', params.subscriptionId)
    .maybeSingle();

  await notifyUser({
    event: 'session_update',
    recipientProfileId: sub?.user_id,
    title: 'اتحدّدت جلسة جديدة',
    message: whenLabel,
    link: `/dashboard/student/sessions/${row.id}`,
  });

  // ⚠️ **الجلسة الزيادة بتتسجّل بسببها.** لو طلع بعد شهور إن الاشتراك
  //    أخد جلسات أكتر من اللي دفع تمنها، ده الأثر الوحيد اللي بيقول
  //    مين قرّر وليه.
  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: plan.quota.isExtra ? 'إنشاء جلسة زيادة عن الباقة' : 'إنشاء جلسة',
    entityType: 'Session',
    entityId: row.id,
    metadata: {
      subscriptionId: params.subscriptionId,
      sessionNumber: row.session_number,
      scheduledAt: when.at.toISOString(),
      instructorId: params.instructorId,
      isExtra: plan.quota.isExtra,
      contracted: plan.quota.contracted,
      scheduledBefore: plan.quota.scheduled,
      reason: reason || null,
      roomReady,
    },
  });

  revalidatePath(`/dashboard/admin/bookings/${params.subscriptionId}`);
  revalidatePath('/dashboard/admin/bookings');
  revalidatePath('/dashboard/admin/rooms');

  return {
    ok: true,
    sessionId: row.id,
    sessionNumber: row.session_number,
    roomReady,
  };
}

export async function updateSessionDetails(params: {
  sessionId: string;
  meetingUrl: string;
  scheduledAt: string;
}) {
  const admin = await requireBookingsAdmin();
  const { sessionId, meetingUrl, scheduledAt } = params;

  const url = meetingUrl.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error('الرابط لازم يبدأ بـ https://');
  }

  // ⚠️ **الموعد بيتقرا كساعة حيطة في القاهرة لا بتوقيت جهاز الإداري.**
  //
  //    خانة `datetime-local` بترجّع نصًّا بلا منطقة زمنية، و`new Date()`
  //    كانت بتقراه بتوقيت الجهاز. يعني إداري بيشتغل من برّه مصر بيأجّل
  //    جلسة لـ«٥ العصر» فتتسجّل ٤ بتوقيت القاهرة — **والشاشة كلها
  //    بتعرض بتوقيت القاهرة فهو نفسه مش هيلاحظ**، والمدرب والطالب
  //    يقعدوا مستنيين ساعة.
  //
  //    والإشعار اللي بيتبعت بيقول الموعد الغلط كمان، فالتأكيد نفسه
  //    بيأكّد الغلط.
  const when = parseCairoInput(scheduledAt) ?? new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error('الموعد غير صحيح');

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('sessions')
    .select('scheduled_at, instructor_id, course_subscription_id')
    .eq('id', sessionId)
    .maybeSingle();

  const { data: saved, error } = await supabase
    .from('sessions')
    .update({
      meeting_url: url || null,
      scheduled_at: when.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select('id');

  if (error) {
    console.error('Error updating session', error);
    throw new Error('تعذّر حفظ بيانات الجلسة');
  }
  // من غير الفحص ده الإدارة بتشوف «اتحفظ» وبيتبعت إشعار تعديل موعد
  // للمدرب وللطالب، والجلسة في القاعدة ما اتغيّرش فيها حاجة.
  if (!saved || saved.length === 0) {
    throw new Error('الجلسة مش موجودة — التعديل مروّحش للقاعدة.');
  }

  // المقارنة بتتم بالوقت الفعلي مش بالنص. القاعدة بترجّع
  // `2026-09-20T13:00:00+00:00` و`toISOString()` بيدّي
  // `2026-09-20T13:00:00.000Z` — نفس اللحظة بالظبط، ونصّين مختلفين.
  // يعني مقارنة النص كانت **دايمًا** بتقول «الموعد اتغيّر»، فأي تعديل
  // لرابط الجلسة كان بيبعت للمدرب وللطالب إشعار كاذب إن الميعاد اتأجّل.
  const previousTime = before?.scheduled_at ? new Date(before.scheduled_at).getTime() : null;
  const rescheduled = previousTime !== null && previousTime !== when.getTime();

  // Both sides need to know — a moved session that nobody is told about is
  // a missed session.
  if (before?.instructor_id) {
    await notifyUser({
      event: 'session_update',
      recipientProfileId: await getInstructorUserId(before.instructor_id),
      title: rescheduled ? 'تم تعديل موعد جلسة' : 'تم تحديث رابط الجلسة',
      message: when.toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'full', timeStyle: 'short' }),
      link: `/dashboard/instructor/sessions/${sessionId}`,
    });
  }

  if (before?.course_subscription_id) {
    const { data: sub } = await supabase
      .from('course_subscriptions')
      .select('user_id')
      .eq('id', before.course_subscription_id)
      .maybeSingle();

    await notifyUser({
      event: 'session_update',
      recipientProfileId: sub?.user_id,
      title: rescheduled ? 'تم تعديل موعد جلستك' : 'تم تحديث رابط جلستك',
      message: when.toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'full', timeStyle: 'short' }),
      link: `/dashboard/student/sessions/${sessionId}`,
    });
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: rescheduled ? 'session_rescheduled' : 'session_updated',
    entityType: 'Session',
    entityId: sessionId,
    metadata: { meetingUrl: url || null, scheduledAt: when.toISOString() },
  });

  revalidatePath(`/dashboard/admin/sessions/${sessionId}`);
  revalidatePath(`/dashboard/instructor/sessions/${sessionId}`);
  revalidatePath(`/dashboard/student/sessions/${sessionId}`);
  revalidatePath('/dashboard/admin/bookings');
  return { ok: true };
}
