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
    .select('instructor_id, publisher_id, provider_id, amount')
    .single();

  if (error || !data) {
    console.error('Error updating withdrawal request', error);
    return { ok: false, error: 'تعذّر تحديث الطلب' };
  }

  const ownerKind: 'instructor' | 'publisher' | 'provider' =
    data.publisher_id != null ? 'publisher' : data.provider_id != null ? 'provider' : 'instructor';
  const ownerId =
    (ownerKind === 'publisher'
      ? data.publisher_id
      : ownerKind === 'provider'
        ? data.provider_id
        : data.instructor_id) as string;

  // ── «تم التحويل» لازم تكون قفلت الرصيد فعلًا ───────────────
  //
  // ⚠️ **لحد ملف 20261016130000 ماكانتش بتقفله خالص.** الحالة بتتغيّر
  //    على الطلب، والمستحقات تفضل `pending`، فالرصيد مايتغيّرش والمدرب
  //    يطلب نفس الفلوس تاني — **بلا حد**. المحفّز هو اللي بيقفلها
  //    دلوقتي، والقراءة دي بتتأكد إنه اشتغل.
  //
  //    من غير الفحص ده، لو المحفّز اتشال أو ماتشغّلش، الشاشة هتقول «تم»
  //    والثغرة ترجع في صمت — وهي بالظبط الحاجة اللي مايصحّش نثق فيها
  //    من غير ما نشوفها.
  if (status === 'paid') {
    const stillOpen = await supabase
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('owner_kind', ownerKind)
      .eq('owner_id', ownerId)
      .eq('status', 'pending');

    // مستحقات اتسجّلت **بعد** الطلب مش غلط — دي شغل جديد. اللي بيقلق
    // هو إن العدد يفضل زيّ ما هو؛ وده بيتشاف من التقرير في آخر الملف،
    // فهنا بنسجّل وبس ومابنفشّلش عملية تحويل حصلت فعلًا.
    if (stillOpen.error) {
      console.error('withdrawal paid: could not verify payouts closed', stillOpen.error);
    } else if ((stillOpen.count ?? 0) > 0) {
      console.warn(
        `withdrawal ${requestId} marked paid; ${stillOpen.count} payouts still pending for this owner`,
      );
    }
  }

  const titles: Record<string, string> = {
    approved: 'تم اعتماد طلب السحب',
    paid: 'تم تحويل مستحقاتك',
    rejected: 'لم يُعتمد طلب السحب',
  };

  // ⚠️ **مقدّم الخدمة المستقل `user_id` على صفه مباشرة** — مفيش دالة
  //    وسيطة زي المدرب والناشر، فالقراءة من الجدول هنا.
  let recipient: string | null = null;
  if (ownerKind === 'publisher') {
    recipient = await getPublisherUserId(ownerId);
  } else if (ownerKind === 'instructor') {
    recipient = await getInstructorUserId(ownerId);
  } else {
    const { data: prov } = await supabase
      .from('service_providers')
      .select('user_id')
      .eq('id', ownerId)
      .maybeSingle();
    recipient = prov?.user_id ?? null;
  }

  await notifyUser({
    event: 'withdrawal',
    recipientProfileId: recipient,
    title: titles[status],
    message: adminNotes?.trim(),
    // الرابط لازم يوديه للوحته هو — كل لوحة مقفولة على التانية.
    link:
      ownerKind === 'publisher'
        ? '/dashboard/publisher/payouts'
        : ownerKind === 'provider'
          ? '/dashboard/provider/payouts'
          : '/dashboard/instructor/payouts',
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
  revalidatePath('/dashboard/provider/payouts');
  revalidatePath('/dashboard/admin');
  return { ok: true };
}
