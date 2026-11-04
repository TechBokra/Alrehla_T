'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { notifyUser } from '@/lib/notifications';
import { logAuditAction } from '@/lib/audit';

/**
 * إرسال الفريق لنسخة النص لولي الأمر.
 *
 * ⚠️ **بترجّع ولا بترمي** (قاعدة «هـ»).
 * ⚠️ قرار ولي الأمر على النص اتشال (٢٥ أكتوبر: العميل بيراجع صورة البطل بس —
 *    `actions/image-review`). الحارس في القاعدة (`story_version_guard`).
 */

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
