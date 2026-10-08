'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { notifyUser, getInstructorUserId, getPublisherUserId } from '@/lib/notifications';

/**
 * البتّ في طلب سحب — لمدرب أو لناشر.
 *
 * المدربون كانوا يقدّموا طلبات واللوحة بتعدّها، ومفيش شاشة تفتح
 * الطلب — فالطلب يفضل بلا رد والمدرب مستني فلوسه.
 *
 * ⚠️ **وبعد ملف 100 الطلب ممكن يكون لناشر.** الكود القديم كان بينادي
 *    `getInstructorUserId(data.instructor_id)` على طول — ومع صف
 *    ناشر العمود ده **فاضي**، فالإشعار كان هيروح لحساب فاضي:
 *    الإدارة تعتمد التحويل، والناشر مايعرفش. **عملية بتنجح ومحدّش
 *    بيشوف نتيجتها** — نفس فئة الأعطال اللي بنقفلها.
 */
export type WithdrawalStatusResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'adminNotes' };

export async function setWithdrawalStatus(params: {
  requestId: string;
  status: 'approved' | 'paid' | 'rejected';
  adminNotes?: string;
}): Promise<WithdrawalStatusResult> {
  // ⚠️ بترجّع ولا بترمي (قاعدة «هـ») — `requireAdmin` بترمي فبتتلفّ هنا.
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin('canManageFinance', 'غير مصرح لك بإدارة طلبات السحب');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإدارة طلبات السحب' };
  }

  const { requestId, status, adminNotes } = params;
  if (status === 'rejected' && !adminNotes?.trim()) {
    return { ok: false, error: 'اكتب سبب الرفض ليصل لصاحب الطلب', field: 'adminNotes' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .update({
      status,
      admin_notes: adminNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('instructor_id, publisher_id, amount')
    .single();

  if (error || !data) {
    console.error('Error updating withdrawal request', error);
    return { ok: false, error: 'تعذّر تحديث الطلب' };
  }

  const titles: Record<string, string> = {
    approved: 'تم اعتماد طلب السحب',
    paid: 'تم تحويل مستحقاتك',
    rejected: 'لم يُعتمد طلب السحب',
  };

  const isPublisher = data.publisher_id != null;

  await notifyUser({
    event: 'withdrawal',
    recipientProfileId: isPublisher
      ? await getPublisherUserId(data.publisher_id as string)
      : await getInstructorUserId(data.instructor_id as string),
    title: titles[status],
    message: adminNotes?.trim(),
    // الرابط لازم يوديه للوحته هو — لوحة المدرب مقفولة على الناشر.
    link: isPublisher ? '/dashboard/publisher/payouts' : '/dashboard/instructor/payouts',
  });

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: `withdrawal_${status}`,
    entityType: 'WithdrawalRequest',
    entityId: requestId,
    metadata: { amount: data.amount, notes: adminNotes ?? null },
  });

  revalidatePath('/dashboard/admin/finance/withdrawals');
  revalidatePath('/dashboard/instructor/payouts');
  revalidatePath('/dashboard/publisher/payouts');
  revalidatePath('/dashboard/admin');
  return { ok: true };
}
