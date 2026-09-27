'use server';

import { requireAdmin, requireUser } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import {
  createMeetingToken,
  createSessionRoom,
  createTestRoom,
  isDailyConfigured,
} from '@/lib/daily';
import { getSiteSettings } from '@/data/domains/content';

export type JoinResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * رابط دخول غرفة جلسة — **بتذكرة باسم الداخل**.
 *
 * ── ليه الرابط مابيتخزّنش جاهزًا ────────────────────────────
 *
 * `sessions.room_url` موجود في القاعدة، بس **الدخول بيه لوحده
 * مرفوض**: الغرف كلها `private`. اللي بيفتح الباب هو تذكرة بتتولّد
 * هنا، لحظة الضغط، وفيها اسم الشخص وصلاحيته ووقت انتهاء.
 *
 * ⚠️ **والسبب إن دي غرف فيها أطفال.** رابط جاهز بيتنسخ ويتبعت
 *    ويفضل شغّالًا؛ التذكرة بتموت مع الجلسة.
 *
 * ── ومين «مالك» الغرفة ──────────────────────────────────────
 *
 * المالك يقدر يبدأ التسجيل ويطرد مشاركًا. **المدرب والإدارة
 * مالكين؛ الطالب وولي الأمر لأ** — طفل يقدر يطرد مدربه مش تصميم.
 */
export async function joinSessionRoom(sessionId: string): Promise<JoinResult> {
  if (!isDailyConfigured()) {
    return { ok: false, error: 'خدمة الغرف مش مظبوطة على الخادم.' };
  }

  const user = await requireUser();
  const supabase = await createClient();

  // ⚠️ **الصفّ بيتقرا بجلسة المستخدم لا بمفتاح الخدمة.** يعني
  //    صلاحيات القاعدة هي اللي بتقرّر مين يشوف الجلسة دي أصلًا —
  //    ولو مش من حقه، بيرجع فاضي (قاعدة «ك») والدالة بتقف هنا.
  const { data: session } = await supabase
    .from('sessions')
    .select('id, room_name, scheduled_at, status, instructor_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return { ok: false, error: 'الجلسة مش موجودة أو مش من حقك.' };
  }
  if (!session.room_name) {
    return { ok: false, error: 'الجلسة دي لسه مالهاش غرفة. كلّم الإدارة.' };
  }

  // المدرب المسنَد والإدارة مالكين.
  const isAdminRole = user.role === 'super_admin' || user.role === 'general_supervisor';
  let isOwner = isAdminRole;
  if (!isOwner && user.role === 'instructor') {
    const { data: instructor } = await supabase
      .from('instructors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    isOwner = Boolean(instructor && instructor.id === session.instructor_id);
  }

  const settings = await getSiteSettings();

  // التذكرة بتنتهي بعد ساعتين من دلوقتي — أطول من أي جلسة، وأقصر
  // من إنها تبقى رابطًا دائمًا.
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const token = await createMeetingToken({
    roomName: session.room_name,
    userName: user.fullName || 'مشارك',
    userId: user.id,
    isOwner,
    expiresAt,
    // التسجيل بيبدأ مع أول مالك يدخل. Daily بيتجاهلها لو التسجيل
    // مقفول في الغرفة أصلًا.
    startRecording: isOwner && settings.sessionRecording.enabled,
  });

  if (!token.ok) return { ok: false, error: token.error };

  // ⚠️ **دخول الإدارة بيتسجّل.** الإدارة بتدخل جلسة فيها طفل —
  //    والدخول اللي مالوش أثر مالوش مساءلة.
  if (isAdminRole) {
    await logAuditAction({
      actorProfileId: user.id,
      actorName: user.fullName,
      action: 'دخل غرفة جلسة',
      entityType: 'session',
      entityId: sessionId,
    });
  }

  const { data: withUrl } = await supabase
    .from('sessions')
    .select('room_url')
    .eq('id', sessionId)
    .maybeSingle();

  if (!withUrl?.room_url) {
    return { ok: false, error: 'رابط الغرفة ناقص. كلّم الإدارة.' };
  }

  return { ok: true, url: `${withUrl.room_url}?t=${token.data.token}` };
}

export type TestRoomResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * غرفة تجربة للإدارة.
 *
 * ⚠️ **مش مربوطة بجلسة ومابتتسجّلش.** الغرض تجربة الصوت والصورة
 *    والشبكة قبل أول جلسة حقيقية — وتسجيل تجربة بيتحاسب بلا سبب.
 *
 * بتنتهي بعد ساعة عشان اللوحة ما تتملاش غرف تجارب منسية.
 */
export async function openTestRoom(): Promise<TestRoomResult> {
  try {
    await requireAdmin('canManageBookings', 'غير مصرح لك بإنشاء غرف');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإنشاء غرف' };
  }

  if (!isDailyConfigured()) {
    return { ok: false, error: 'مفتاح Daily مش مظبوط على الخادم.' };
  }

  const room = await createTestRoom();
  if (!room.ok) return { ok: false, error: room.error };

  const user = await requireUser();
  const token = await createMeetingToken({
    roomName: room.data.name,
    userName: user.fullName || 'الإدارة',
    userId: user.id,
    isOwner: true,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  if (!token.ok) return { ok: false, error: token.error };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'فتح غرفة تجربة',
    entityType: 'session',
    entityId: room.data.name,
  });

  return { ok: true, url: `${room.data.url}?t=${token.data.token}` };
}

export type EnsureRoomResult =
  | { ok: true; created: number; failed: number }
  | { ok: false; error: string };

/**
 * تجهيز غرف للجلسات القادمة اللي مالهاش غرفة.
 *
 * ── ليه الدالة دي موجودة أصلًا ──────────────────────────────
 *
 * التشخيص (ملف 110) قال: **٦٠ جلسة، منها ٥٨ قادمة، وصفر منها ليها
 * رابط لقاء.** يعني جلسات مدفوعة ومجدولة ومالهاش مكان يتقابلوا فيه.
 *
 * الغرف الجديدة بتتعمل مع الحجز من دلوقتي ورايح، لكن الـ٥٨ دول
 * محتاجين تجهيزًا. الزرّ ده بيعملهم.
 *
 * ⚠️ **بيكمّل لو واحدة فشلت.** إنشاء الغرفة نداء شبكة، وفشل غرفة
 *    مايمنعش الباقي. بنرجّع العدد ناجح/فاشل والإدارة تعيد.
 *
 * ⚠️ **وبيتخطّى اللي ليها غرفة خلاص** — إعادة الإنشاء بتعمل غرفة
 *    تانية وتسيب الأولى شغّالة، وبتتحاسب.
 */
export async function ensureUpcomingRooms(limit = 25): Promise<EnsureRoomResult> {
  try {
    await requireAdmin('canManageBookings', 'غير مصرح لك بتجهيز الغرف');
  } catch {
    return { ok: false, error: 'غير مصرح لك بتجهيز الغرف' };
  }

  if (!isDailyConfigured()) {
    return { ok: false, error: 'مفتاح Daily مش مظبوط على الخادم.' };
  }

  const supabase = await createClient();
  const settings = await getSiteSettings();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, scheduled_at')
    .is('room_name', null)
    .gt('scheduled_at', new Date().toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error loading sessions for room prep', error);
    return { ok: false, error: 'تعذّر قراءة الجلسات.' };
  }
  if (!sessions || sessions.length === 0) {
    return { ok: true, created: 0, failed: 0 };
  }

  let created = 0;
  let failed = 0;

  for (const session of sessions) {
    const room = await createSessionRoom({
      sessionId: session.id,
      startsAt: new Date(session.scheduled_at),
      // مدة الجلسة الثابتة في المشروع. لو بقت من الباقة، بتتقرا منها.
      durationMinutes: 40,
      recordingEnabled: settings.sessionRecording.enabled,
    });

    if (!room.ok) {
      failed += 1;
      continue;
    }

    const expiresAt = settings.sessionRecording.enabled
      ? new Date(
          new Date(session.scheduled_at).getTime() +
            settings.sessionRecording.retentionDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    // ⚠️ **بـ`select()`** — الكتابة على صفر صفوف بتنجح في صمت
    //    (قاعدة «و»). من غيرها كنا هنعدّ غرفة كأنها اتسجّلت وهي لأ،
    //    وتفضل شغّالة عند Daily بلا أي جلسة تعرفها.
    const { data: saved } = await supabase
      .from('sessions')
      .update({
        room_name: room.data.name,
        room_url: room.data.url,
        recording_expires_at: expiresAt,
        recording_status: settings.sessionRecording.enabled ? 'pending' : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .select('id');

    if (saved && saved.length > 0) created += 1;
    else failed += 1;
  }

  await logAuditAction({
    action: 'جهّز غرف الجلسات',
    entityType: 'session',
    metadata: { created, failed },
  });

  return { ok: true, created, failed };
}
