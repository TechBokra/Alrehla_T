import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PreviewRow } from '@/lib/story-preview';

/**
 * معاينات ولي الأمر على طلب واحد.
 *
 * ⚠️ **دالة في القاعدة، مش استعلام على `story_versions`.**
 *
 *    صلاحيات الجدول للقراءة `story_studio_access()` — فاستعلام
 *    مباشر من حساب ولي الأمر بيرجّع **صفر صفوف** (قاعدة «ك»:
 *    الرفض بيرجع فاضي مش خطأ). والشاشة كانت هتقول «مفيش معاينة»
 *    وهي موجودة.
 *
 *    `my_story_previews` دالة SECURITY DEFINER بترجّع النسخ
 *    المبعوتة له وحدها، وبالحقول اللي تخصّه — مش كل أعمدة الصف
 *    (اللي فيها مين كتب ومين اعتمد وملاحظات الفريق).
 *
 * ⚠️ **وفشل القراءة بيرمي، مابيرجّعش `[]`.** لو رجّعنا فاضي عند
 *    الخطأ، ولي الأمر بيشوف «مفيش حاجة مستنيّاك» على طلب فيه نص
 *    مستني قراره — والطلب بيقف وهو مطمّن. الصفحة بتعرض خطأ أهون.
 */
export async function getMyStoryPreviews(orderId: string): Promise<PreviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_story_previews', { p_order_id: orderId });

  if (error) {
    console.error('Error reading story previews', { orderId, error });
    throw new Error('تعذّر تحميل المعاينة. جرّب تاني بعد لحظات.');
  }

  return (data ?? []).map((r) => ({
    projectId: r.project_id,
    orderItemId: r.order_item_id,
    productId: r.product_id,
    projectStatus: r.project_status,
    versionId: r.version_id,
    versionNo: r.version_no,
    body: r.body,
    versionStatus: r.version_status,
    sentAt: r.sent_at,
    decisionAt: r.decision_at,
    decisionNote: r.decision_note,
    decidedByMe: r.decided_by_me === true,
  }));
}

/**
 * فيه معاينة مستنية قراره على الطلب ده؟ — لقايمة الطلبات.
 *
 * ⚠️ بترجّع صفر عند الفشل عن قصد، على خلاف اللي فوق: دي بتحطّ
 *    سطرًا إضافيًا في القايمة، وفشلها مايستاهلش يكسّر صفحة
 *    الطلبات كلها. والصفحة نفسها بترمي لو فشلت.
 */
export async function countAwaitingPreviews(orderId: string): Promise<number> {
  try {
    const rows = await getMyStoryPreviews(orderId);
    const latest = new Map<string, string>();
    for (const r of rows) {
      if (!latest.has(r.orderItemId)) latest.set(r.orderItemId, r.versionStatus);
    }
    return [...latest.values()].filter((s) => s === 'editor_approved').length;
  } catch {
    return 0;
  }
}
