'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';

/**
 * Customer ratings.
 *
 * The rule that matters — only the buyer of a completed order may write one,
 * once — lives in row-level security. The checks here exist so the person gets
 * a clear message, not because they are the guard.
 */

export async function submitServiceReview(params: {
  orderId: string;
  instructorRating: number;
  serviceRating: number;
  comment: string;
}) {
  const { orderId, instructorRating, serviceRating, comment } = params;

  const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;
  if (!inRange(instructorRating) || !inRange(serviceRating)) {
    throw new Error('التقييم لازم يكون من 1 إلى 5');
  }
  if (comment.length > 2000) throw new Error('التعليق طويل جدًا');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const { data: order } = await supabase
    .from('service_orders')
    .select('id, buyer_profile_id, instructor_id, standalone_service_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) throw new Error('الطلب غير موجود');
  if (order.buyer_profile_id !== user.id) throw new Error('هذا الطلب ليس طلبك');
  if (order.status !== 'completed') throw new Error('يمكن التقييم بعد اكتمال الطلب فقط');
  if (!order.instructor_id) throw new Error('هذا الطلب بلا مدرب مسنَد');

  const { error } = await supabase.from('reviews').insert({
    instructor_id: order.instructor_id,
    reviewer_profile_id: user.id,
    service_order_id: order.id,
    standalone_service_id: order.standalone_service_id,
    rating: instructorRating,
    service_rating: serviceRating,
    comment: comment.trim() || null,
  });

  if (error) {
    // The unique index on service_order_id is what enforces one review per order.
    if (String(error.message).toLowerCase().includes('duplicate')) {
      throw new Error('سبق أن قيّمت هذا الطلب');
    }
    console.error('Error submitting review', error);
    throw new Error('تعذّر حفظ التقييم');
  }

  revalidatePath(`/account/orders/creative-writing/${orderId}`);
  revalidatePath('/creative-writing/instructors');
  revalidatePath(`/creative-writing/instructors/${order.instructor_id}`);
  revalidatePath('/dashboard/instructor/ratings');
  revalidatePath('/dashboard/admin/reviews');
  return { ok: true };
}

/**
 * Hiding an abusive or off-topic review, with the reason recorded.
 *
 * Reviews publish immediately and are not approved beforehand: requiring
 * approval would in practice mean negative reviews never appear, and a page of
 * nothing but five stars convinces nobody.
 */
export async function setReviewHidden(
  reviewId: string,
  isHidden: boolean,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string; field?: 'reason' }> {
  // ⚠️ بترجّع ولا بترمي (قاعدة «هـ») — `requireAdmin` بترمي فبتتلفّ هنا.
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin('canManageContent', 'غير مصرح لك بإدارة التقييمات');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإدارة التقييمات' };
  }
  if (isHidden && !reason.trim()) {
    return { ok: false, error: 'اكتب سبب الإخفاء', field: 'reason' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .update({
      is_hidden: isHidden,
      hidden_reason: isHidden ? reason.trim() : null,
    })
    .eq('id', reviewId)
    .select('instructor_id')
    .single();

  if (error || !data) {
    console.error('Error hiding review', error);
    return { ok: false, error: 'تعذّر تنفيذ الإجراء' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: isHidden ? 'review_hidden' : 'review_unhidden',
    entityType: 'Review',
    entityId: reviewId,
    metadata: isHidden ? { reason: reason.trim() } : {},
  });

  revalidatePath('/dashboard/admin/reviews');
  revalidatePath('/creative-writing/instructors');
  revalidatePath(`/creative-writing/instructors/${data.instructor_id}`);
  return { ok: true };
}
