'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';

/**
 * إشعارات الإدارة: إرسال جماعي، والتحكم في الأنواع.
 *
 * الإرسال بيمر على دالة في القاعدة مش insert مباشر: لو كان insert،
 * أي حساب مسجّل كان هيقدر يبعت إشعار لأي حد. الدالة بتتأكد إن اللي
 * بينادي عليها إداري قبل ما تكتب أي صف.
 */
export type NotifyResult =
  | { ok: true; count: number }
  | { ok: false; error: string; field?: 'title' };

export async function sendBroadcast(params: {
  title: string;
  message?: string;
  link?: string;
  /** 'all' أو اسم دور. */
  target: string;
}): Promise<NotifyResult> {
  // requireAdmin بترمي، وNext بيخفي نص أي خطأ مرمي في النسخة المنشورة —
  // فالمستخدم كان هيشوف رسالة عامة. بنمسكها ونرجّعها كنتيجة.
  let admin;
  try {
    admin = await requireAdmin('canManageContent', 'غير مصرح لك بإرسال الإشعارات');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإرسال الإشعارات' };
  }

  const title = params.title.trim();
  if (!title) return { ok: false, error: 'اكتب عنوان للإشعار', field: 'title' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('notify_broadcast', {
    p_title: title,
    p_message: params.message?.trim() || undefined,
    p_link: params.link?.trim() || undefined,
    p_role: params.target === 'all' ? undefined : params.target,
  });

  if (error) {
    console.error('Error broadcasting notification', error);
    return { ok: false, error: `تعذّر الإرسال: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'notification_broadcast',
    entityType: 'Notification',
    entityId: 'broadcast',
    metadata: { title, target: params.target, count: data ?? 0 },
  });

  revalidatePath('/dashboard/admin/notifications');
  return { ok: true, count: data ?? 0 };
}

export type SettingsResult = { ok: true } | { ok: false; error: string };

/** الأنواع الموقوفة. الإيقاف بيمنع الإرسال من أصله. */
export async function setDisabledNotificationTypes(
  disabled: string[]
): Promise<SettingsResult> {
  let admin;
  try {
    admin = await requireAdmin('canManageContent', 'غير مصرح لك بتعديل الإعدادات');
  } catch {
    return { ok: false, error: 'غير مصرح لك بتعديل الإعدادات' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: 'notifications', value: { disabled } }, { onConflict: 'key' });

  if (error) {
    console.error('Error saving notification settings', error);
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'notification_types_changed',
    entityType: 'SiteSettings',
    entityId: 'notifications',
    metadata: { disabled },
  });

  revalidatePath('/dashboard/admin/notifications/types');
  return { ok: true };
}
