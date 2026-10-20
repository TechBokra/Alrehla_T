'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, requireAdmin } from '@/lib/auth-guard';
import { notifyUser, notifyAdmins } from '@/lib/notifications';
import { logAuditAction } from '@/lib/audit';
import { noteProblem } from '@/lib/story-preview';

/**
 * قرار ولي الأمر على معاينة النص، وإرسال الفريق للنسخة.
 *
 * ⚠️ **بترجّع ولا بترمي** (قاعدة «هـ»): Next بيمسح نص أي استثناء
 *    من أكشن في الإنتاج، فولي الأمر كان هيشوف رسالة إنجليزي
 *    عامة بدل «اكتب عايز نعدّل إيه».
 *
 * ⚠️ **والحارس مش هنا.** الحارس `story_version_guard` ودالة
 *    `story_preview_decide` في القاعدة — بيتأكدوا إن النسخة على
 *    طلبه، وإنها اتبعتت له، وإنها مستنية قراره. اللي هنا بيدّي
 *    الرسالة العربية ويبعت الإشعار ويفرّغ الكاش.
 */

type Result = { ok: true; decision: 'approved' | 'changes_requested' } | { ok: false; error: string };

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** يرجّع اسم الطلب ومشتريه — للإشعار ولوحة التدقيق. */
async function previewContext(versionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('story_versions')
    .select('version_no, project_id, story_projects(order_id, product_id)')
    .eq('id', versionId)
    .maybeSingle();
  const project = (data?.story_projects ?? null) as { order_id: string; product_id: string } | null;
  return { versionNo: data?.version_no ?? null, orderId: project?.order_id ?? null };
}

/**
 * ولي الأمر وافق على النص، أو طلب تعديل.
 *
 * ⚠️ **الملاحظة إلزامية لطلب التعديل** — وبتتفحص هنا كمان مش في
 *    القاعدة بس، عشان الرسالة تكون مفيدة («قول لنا بالظبط
 *    الحاجة اللي مش عاجبتك») مش رسالة قاعدة بيانات.
 */
export async function decideStoryPreview(params: {
  versionId: string;
  approve: boolean;
  note?: string;
}): Promise<Result> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return { ok: false, error: errMessage(err, 'لازم تسجّل الدخول') };
  }

  if (!params.approve) {
    const problem = noteProblem(params.note ?? '');
    if (problem) return { ok: false, error: problem };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('story_preview_decide', {
    p_version_id: params.versionId,
    p_approve: params.approve,
    p_note: params.note?.trim() || null,
  });

  if (error) {
    console.error('Error recording story preview decision', { versionId: params.versionId, error });
    return { ok: false, error: error.message || 'تعذّر تسجيل قرارك. جرّب تاني.' };
  }

  const decision = data === 'approved' ? 'approved' : 'changes_requested';
  const { versionNo, orderId } = await previewContext(params.versionId);

  // ⚠️ الفريق لازم يعرف دلوقتي: الطلب كان واقف على قراره، وأول
  //    ما ياخده الشغل بيكمّل. إشعار متأخّر = يوم ضايع في الإنتاج.
  await notifyAdmins({
    title:
      decision === 'approved'
        ? 'ولي الأمر وافق على النص'
        : 'ولي الأمر طلب تعديل على النص',
    message:
      decision === 'approved'
        ? `النسخة ${versionNo ?? ''} اتعتمدت — الرسم بقى مفتوح.`
        : `النسخة ${versionNo ?? ''}: ${params.note?.trim().slice(0, 200) ?? ''}`,
    link: orderId ? `/dashboard/admin/orders/${orderId}` : undefined,
    event: 'story_preview',
  });

  await logAuditAction({
    action: decision === 'approved' ? 'story_preview_approved' : 'story_preview_changes_requested',
    entityType: 'story_version',
    entityId: params.versionId,
    actorProfileId: user.id,
    metadata: { orderId, versionNo },
  });

  if (orderId) revalidatePath(`/account/orders/enha-lak/${orderId}/preview`);
  revalidatePath('/account/orders/enha-lak');

  return { ok: true, decision };
}

/**
 * الفريق بيبعت النسخة المعتمدة لولي الأمر يعاينها.
 *
 * ⚠️ **ودي الخطوة اللي كانت ناقصة خالص.** اعتماد المحرّر كان
 *    بيخلّي النسخة «جاهزة»، ومحدش بيقول لولي الأمر. فالفريق كان
 *    بيكلّمه على الواتساب (أو مابيكلّموش ويحطّوا العلامة بنفسهم).
 */
export async function sendStoryVersionToClient(
  versionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let admin;
  try {
    // ⚠️ `canWorkStudio` مش `canManageStudio`: المحرّر هو اللي
    //    خلّص النص، وهو اللي عارف إنه جاهز يتبعت. لو خلّيناها
    //    لمسؤول الإنتاج وحده، النص بيقعد مستني موافقة إدارية
    //    على خطوة مالهاش قرار — ويتأخّر يوم بلا سبب. والحارس في
    //    القاعدة بيمنع إرسال نسخة مش معتمدة بأي حال.
    admin = await requireAdmin('canWorkStudio', 'إرسال المعاينة لفريق الاستوديو');
  } catch (err) {
    return { ok: false, error: errMessage(err, 'غير مصرح') };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('story_version_send_to_client', { p_version_id: versionId });

  if (error) {
    console.error('Error sending story version to client', { versionId, error });
    return { ok: false, error: error.message || 'تعذّر إرسال المعاينة. جرّب تاني.' };
  }

  const { orderId } = await previewContext(versionId);

  // المشتري من الطلب — مش من اللي الشاشة بعتته (قاعدة «ف»).
  let buyerId: string | null = null;
  if (orderId) {
    const { data } = await supabase.from('orders').select('user_id').eq('id', orderId).maybeSingle();
    buyerId = data?.user_id ?? null;
  }

  // ⚠️ فشل الإشعار **مابيلغيش** الإرسال: النسخة بقت مبعوتة في
  //    القاعدة فعلًا، ولو رجّعنا خطأ هنا الفريق هيضغط تاني
  //    والقاعدة ترفض («اتبعتت خلاص») — فيفتكر إنها ما اتبعتتش.
  //    بنقول إنها اتبعتت، والإشعار بيتسجّل فشله في السجل.
  const notified = await notifyUser({
    recipientProfileId: buyerId,
    title: 'نص قصة ابنك جاهز — محتاجين موافقتك',
    message: 'اقراه وقول لنا نكمّل ونبدأ الرسم ولا فيه حاجة تتعدّل. الرسم مابيبدأش قبل موافقتك.',
    link: orderId ? `/account/orders/enha-lak/${orderId}/preview` : undefined,
    event: 'story_preview',
  });

  await logAuditAction({
    action: 'story_version_sent_to_client',
    entityType: 'story_version',
    entityId: versionId,
    actorProfileId: admin.id,
    metadata: { orderId, notified: notified.sent, notifyReason: notified.reason ?? null },
  });

  revalidatePath('/dashboard/admin/studio');
  if (orderId) revalidatePath(`/account/orders/enha-lak/${orderId}/preview`);

  return { ok: true };
}
