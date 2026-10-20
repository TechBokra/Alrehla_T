'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, requireAdmin, requireNotDependent } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notifications';

/**
 * طلبات حذف الحساب.
 *
 * ليه طلب مش حذف فوري (قرارك):
 *   الحساب ممكن يكون عليه طلبات مدفوعة أو مستحقات أو حجوزات جارية،
 *   وحذفه في اللحظة بيسيب سجلات بلا صاحب. فالعميل بيطلب، والإدارة
 *   بتراجع وتنفّذ.
 *
 * ⚠️ الملف ده **ما بيحذفش** حسابات. بيسجّل الطلب ويقفله بعد ما تتعامل
 * معاه يدويًا. الحذف الفعلي بيتم من لوحة Supabase عن قصد: عملية مالهاش
 * رجعة ما ينفعش تتعمل بزرار في صفحة ويب.
 */
export type DeletionResult =
  | { ok: true }
  // `field`: الخانة اللي عليها الخطأ — الشاشة بتعلّمها بالأحمر.
  | { ok: false; error: string; field?: string };

export async function requestAccountDeletion(reason: string): Promise<DeletionResult> {
  // حساب الطفل مش بيطلب حذف نفسه — ولي الأمر هو اللي بيقفله من المركز
  // العائلي. ده كان مفتوح للطفل بالكامل.
  let user;
  try {
    user = await requireNotDependent('طلب حذف الحساب');
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('account_deletion_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'عندك طلب حذف قيد المراجعة بالفعل' };
  }

  const { error } = await supabase.from('account_deletion_requests').insert({
    user_id: user.id,
    reason: reason.trim() || null,
    status: 'pending',
  });

  if (error) {
    console.error('Error filing deletion request', error);
    return { ok: false, error: `تعذّر إرسال الطلب: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'account_deletion_requested',
    entityType: 'UserProfile',
    entityId: user.id,
  });

  await notifyAdmins({
    event: 'account_deletion',
    title: 'طلب حذف حساب',
    message: `${user.fullName} طلب حذف حسابه.`,
    link: '/dashboard/admin/users/deletion-requests',
  });

  revalidatePath('/account');
  revalidatePath('/dashboard/admin/users/deletion-requests');
  return { ok: true };
}

/** الإدارة بتقفل الطلب بعد ما تتعامل معاه، أو ترفضه بسبب. */
export async function resolveDeletionRequest(params: {
  id: string;
  status: 'done' | 'rejected';
  adminNotes?: string;
}): Promise<DeletionResult> {
  // ⚠️ `requireAdmin` بترمي — والرسالة بتتمسح في الإنتاج (قاعدة «هـ»).
  let admin;
  try {
    admin = await requireAdmin('canManageUsers', 'غير مصرح لك بإدارة الحسابات');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإدارة الحسابات' };
  }

  if (params.status === 'rejected' && !params.adminNotes?.trim()) {
    return { ok: false, error: 'اكتب سبب الرفض — العميل المفروض يعرف', field: 'adminNotes' };
  }

  const supabase = await createClient();
  // قاعدة «و» + منع البتّ مرتين: الشرط على الحالة في الاستعلام نفسه.
  const { data: decided, error } = await supabase
    .from('account_deletion_requests')
    .update({
      status: params.status,
      admin_notes: params.adminNotes?.trim() || null,
      handled_at: new Date().toISOString(),
      handled_by: admin.id,
    })
    .eq('id', params.id)
    .eq('status', 'pending')
    .select('id');

  if (!error && (!decided || decided.length === 0)) {
    return { ok: false, error: 'الطلب ده اتبتّ فيه قبل كده، أو مش موجود.' };
  }

  if (error) {
    console.error('Error resolving deletion request', error);
    return { ok: false, error: `تعذّر التحديث: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'account_deletion_resolved',
    entityType: 'AccountDeletionRequest',
    entityId: params.id,
    metadata: { status: params.status },
  });

  revalidatePath('/dashboard/admin/users/deletion-requests');
  return { ok: true };
}
