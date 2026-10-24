'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, requireAdmin } from '@/lib/auth-guard';
import { notifyUser, notifyAdmins } from '@/lib/notifications';
import { logAuditAction } from '@/lib/audit';
import { imageNoteProblem } from '@/lib/image-review';
import { REVIEW_DELAY_NOTE } from '@/lib/delivery-days';

/**
 * مراجعة صورة البطل — الفريق بيبعت، وولي الأمر بيقرّر.
 *
 * ⚠️ **بترجّع ولا بترمي** (قاعدة «هـ»). والقواعد الحقيقية في
 *    القاعدة (`story_image_send` / `story_image_decide`): الصورة على
 *    طلبه، ومستنية قراره، والمرحلة «الشخصية».
 */

type Fail = { ok: false; error: string };

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function missingFunction(code: string | undefined): boolean {
  return code === 'PGRST202' || code === '42883' || code === '42P01';
}

async function projectOrder(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('story_projects')
    .select('order_id, orders(user_id)')
    .eq('id', projectId)
    .maybeSingle();
  const order = (data?.orders ?? null) as { user_id: string | null } | null;
  return { orderId: data?.order_id ?? null, buyerId: order?.user_id ?? null };
}

/** الفريق بيبعت صورة البطل المحفوظة لولي الأمر. */
export async function sendCharacterImageToClient(
  projectId: string,
  note?: string,
): Promise<{ ok: true } | Fail> {
  let admin;
  try {
    admin = await requireAdmin('canWorkStudio', 'إرسال صورة البطل لفريق الاستوديو');
  } catch (err) {
    return { ok: false, error: errMessage(err, 'غير مصرح') };
  }

  const supabase = await createClient();
  const { data: reviewId, error } = await supabase.rpc('story_image_send', {
    p_project_id: projectId,
    p_note: note?.trim() || null,
  });

  if (error) {
    if (missingFunction(error.code)) {
      return { ok: false, error: 'خاصية إرسال الصورة محتاجة تحديث القاعدة (ترحيل 20261025090000).' };
    }
    console.error('Error sending character image', { projectId, error });
    return { ok: false, error: error.message || 'تعذّر إرسال الصورة. جرّب تاني.' };
  }

  const { orderId, buyerId } = await projectOrder(projectId);

  // ⚠️ فشل الإشعار مابيلغيش الإرسال — الصورة اتسجّلت فعلًا.
  const notified = await notifyUser({
    recipientProfileId: buyerId,
    title: 'صورة البطل جاهزة — محتاجين موافقتك',
    message: `شوف الصورة اللي هنرسم بيها القصة ووافق أو اطلب تعديل. ${REVIEW_DELAY_NOTE}`,
    link: orderId ? `/account/orders/enha-lak/${orderId}/preview` : undefined,
    event: 'story_preview',
  });

  await logAuditAction({
    action: 'story_image_sent_to_client',
    entityType: 'story_project',
    entityId: projectId,
    actorProfileId: admin.id,
    metadata: { orderId, reviewId, notified: notified.sent, notifyReason: notified.reason ?? null },
  });

  revalidatePath(`/dashboard/admin/studio/${projectId}`);
  if (orderId) revalidatePath(`/account/orders/enha-lak/${orderId}/preview`);
  return { ok: true };
}

/** ولي الأمر وافق على صورة البطل، أو طلب تعديل. */
export async function decideCharacterImage(params: {
  reviewId: string;
  orderId: string;
  approve: boolean;
  note?: string;
}): Promise<{ ok: true; decision: 'approved' | 'changes_requested' } | Fail> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'لازم تسجّل الدخول') };
  }

  if (!params.approve) {
    const problem = imageNoteProblem(params.note ?? '');
    if (problem) return { ok: false, error: problem };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('story_image_decide', {
    p_review_id: params.reviewId,
    p_approve: params.approve,
    p_note: params.note?.trim() || null,
  });

  if (error) {
    console.error('Error recording image decision', { reviewId: params.reviewId, error });
    return { ok: false, error: error.message || 'تعذّر تسجيل قرارك. جرّب تاني.' };
  }

  const decision = data === 'approved' ? 'approved' : 'changes_requested';

  await notifyAdmins({
    title: decision === 'approved' ? 'ولي الأمر وافق على صورة البطل' : 'ولي الأمر طلب تعديل على صورة البطل',
    message:
      decision === 'approved'
        ? 'المرجع اتعتمد — المشاهد بقت مفتوحة.'
        : (params.note?.trim().slice(0, 200) ?? ''),
    link: `/dashboard/admin/orders/${params.orderId}`,
    event: 'story_preview',
  });

  await logAuditAction({
    action: decision === 'approved' ? 'story_image_approved' : 'story_image_changes_requested',
    entityType: 'story_image_review',
    entityId: params.reviewId,
    actorProfileId: user.id,
    metadata: { orderId: params.orderId },
  });

  revalidatePath(`/account/orders/enha-lak/${params.orderId}/preview`);
  revalidatePath('/account/orders/enha-lak');
  return { ok: true, decision };
}
