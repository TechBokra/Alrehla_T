'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireSuperAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { getSiteSettings } from '@/data/domains/content';
import {
  SESSION_ROOM_PREFIX,
  deleteRecording,
  getRecordingLink,
  isDailyConfigured,
} from '@/lib/daily';
import { purgeExpiredRecordings } from '@/lib/recording-purge';

export type RecordingLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * رابط مشاهدة تسجيل — **مؤقّت ومسجَّل**.
 *
 * ── ليه مش رابط ثابت في الشاشة ──────────────────────────────
 *
 * ⚠️ **دي تسجيلات فيها أطفال.** رابط دائم بيتنسخ ويتبعت على واتساب
 *    ويفضل شغّالًا بعد ما كل حد نسي إنه اتبعت. الرابط هنا بيتولّد
 *    لحظة الضغط وبيموت بعد ساعة — نفس منطق تذكرة الغرفة.
 *
 * ⚠️ **والمشاهدة بتتسجّل في التدقيق.** إداري بيتفرّج على جلسة فيها
 *    طفل، والفرجة اللي مالهاش أثر مالهاش مساءلة. ده نفس اللي عملناه
 *    لدخول الإدارة الغرف.
 *
 * ⚠️ **وبرّه بادئة غرف الجلسات مفيش رابط.** الحساب ممكن يتشارك مع
 *    مشروع تاني، والشاشة مش بوابة لتسجيلاته.
 */
export async function openRecording(
  recordingId: string,
  roomName: string,
): Promise<RecordingLinkResult> {
  let user;
  try {
    user = await requireAdmin('canManageBookings', 'غير مصرح لك بمشاهدة التسجيلات');
  } catch {
    return { ok: false, error: 'غير مصرح لك بمشاهدة التسجيلات' };
  }

  if (!isDailyConfigured()) {
    return { ok: false, error: 'مفتاح Daily مش مظبوط على الخادم.' };
  }

  // ⚠️ الفحص على الخادم لا في الشاشة — الأكشن ممكن يتنادى من غير
  //    الشاشة خالص (قاعدة «ع»).
  if (!roomName.startsWith(SESSION_ROOM_PREFIX)) {
    return { ok: false, error: 'التسجيل ده مش تابع لجلسة من جلسات الموقع.' };
  }

  const link = await getRecordingLink(recordingId);
  if (!link.ok) return { ok: false, error: link.error };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'فتح تسجيل جلسة',
    entityType: 'session',
    entityId: roomName.slice(SESSION_ROOM_PREFIX.length),
    metadata: { recordingId },
  });

  return { ok: true, url: link.data.url };
}

export type RemoveRecordingResult = { ok: true } | { ok: false; error: string };

/**
 * حذف تسجيل يدويًّا.
 *
 * ⚠️ **مدير النظام وحده — مش أي إداري.**
 *
 *    `canManageBookings` صلاحية واسعة عند المشرف العام كمان، والتسجيل
 *    هو **الأثر الوحيد** للّي حصل في جلسة فيها طفل. لو جت شكوى بعد
 *    شهر، ده اللي بيتراجع. فحذفه قرار مالوش تراجع على دليل، ومحتاج
 *    شرطًا على المنفِّذ لا على الشاشة (درس §16 في الدفتر).
 */
export async function removeRecording(
  recordingId: string,
  roomName: string,
): Promise<RemoveRecordingResult> {
  let user;
  try {
    user = await requireSuperAdmin('حذف التسجيلات لمدير النظام وحده');
  } catch {
    return { ok: false, error: 'حذف التسجيلات لمدير النظام وحده' };
  }

  if (!isDailyConfigured()) {
    return { ok: false, error: 'مفتاح Daily مش مظبوط على الخادم.' };
  }

  if (!roomName.startsWith(SESSION_ROOM_PREFIX)) {
    return { ok: false, error: 'التسجيل ده مش تابع لجلسة من جلسات الموقع.' };
  }

  const result = await deleteRecording(recordingId);
  if (!result.ok) return { ok: false, error: result.error };

  // ⚠️ بيتسجّل **برقم التسجيل والغرفة** مش بعددهم. ده الأثر الوحيد
  //    اللي هيفضل لو طلع إن التسجيل ده كان مهمًّا.
  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'حذف تسجيل جلسة',
    entityType: 'session',
    entityId: roomName.slice(SESSION_ROOM_PREFIX.length),
    metadata: { recordingId, roomName },
  });

  revalidatePath('/dashboard/admin/rooms');
  return { ok: true };
}

export type PurgeNowResult =
  | { ok: true; deleted: number; failed: number }
  | { ok: false; error: string };

/**
 * تشغيل حذف المنتهي **دلوقتي** بدل انتظار المهمة اليومية.
 *
 * موجود عشان الإدارة تقدر تشوف بعينها إن الوعد بيتنفّذ، بدل ما تستنى
 * لبكرة وتفترض. بيستعمل نفس الدالة اللي المهمة بتستعملها بالظبط —
 * فاللي بتجرّبه هنا هو اللي بيحصل هناك.
 */
export async function purgeRecordingsNow(): Promise<PurgeNowResult> {
  let user;
  try {
    user = await requireSuperAdmin('حذف التسجيلات لمدير النظام وحده');
  } catch {
    return { ok: false, error: 'حذف التسجيلات لمدير النظام وحده' };
  }

  if (!isDailyConfigured()) {
    return { ok: false, error: 'مفتاح Daily مش مظبوط على الخادم.' };
  }

  const settings = await getSiteSettings();
  if (!settings.sessionRecording.enabled) {
    return { ok: false, error: 'التسجيل مقفول في الإعدادات.' };
  }

  const result = await purgeExpiredRecordings({
    retentionDays: settings.sessionRecording.retentionDays,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'حذف التسجيلات المنتهية يدويًّا',
    entityType: 'session',
    metadata: {
      retentionDays: settings.sessionRecording.retentionDays,
      recordingIds: result.data.deleted,
      rooms: result.data.rooms,
      failed: result.data.failed,
    },
  });

  revalidatePath('/dashboard/admin/rooms');
  return { ok: true, deleted: result.data.deleted.length, failed: result.data.failed };
}
