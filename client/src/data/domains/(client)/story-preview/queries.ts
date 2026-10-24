import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PreviewRow } from '@/lib/story-preview';
import type { ImageReviewRow } from '@/lib/image-review';

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

/**
 * صور البطل اللي اتبعتت لولي الأمر على طلب واحد — المراجعة بقت
 * للصورة بس (قرار تامر، ٢٥ أكتوبر).
 *
 * ⚠️ لو ترحيل `20261025090000` لسه ماتشغّلش، الدالة مش موجودة
 *    (`PGRST202`) — بنرجّع فاضي بدل ما نكسر صفحة الطلبات.
 *    أي خطأ تاني بيرمي، لنفس سبب `getMyStoryPreviews`.
 */
export async function getMyImageReviews(orderId: string): Promise<ImageReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_story_image_reviews', { p_order_id: orderId });

  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return [];
    console.error('Error reading image reviews', { orderId, error });
    throw new Error('تعذّر تحميل صورة البطل. جرّب تاني بعد لحظات.');
  }

  return (data ?? []).map((r) => ({
    projectId: r.project_id,
    orderItemId: r.order_item_id,
    productId: r.product_id,
    reviewId: r.review_id,
    imageUrl: r.image_url,
    staffNote: r.staff_note,
    status: r.status,
    sentAt: r.sent_at,
    decidedAt: r.decided_at,
    clientNote: r.client_note,
    characterApproved: r.character_approved === true,
  }));
}

