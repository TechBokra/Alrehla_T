'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { notifyAdmins } from '@/lib/notifications';
import {
  FEEDBACK_ADMIN_HREF,
  FEEDBACK_LINE_LABELS,
  isFeedbackLine,
} from '@/lib/feedback-lines';

type Result = { ok: true } | { ok: false; error: string; field?: 'comment' };

/**
 * رأي العميل في خط («إنها لك» / «بداية الرحلة») — ملف 10.
 *
 * ⚠️ «استعمل الخط ده؟» القاعدة هي اللي بتحرسه (سياسة الإدخال بـ`used_line`)
 *    — الفحص هنا عشان الرسالة تبقى مفهومة بس.
 */
export async function submitFeedback(params: {
  line: string;
  rating: number;
  comment: string;
}): Promise<Result> {
  if (!isFeedbackLine(params.line)) return { ok: false, error: 'اختار القسم' };
  if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
    return { ok: false, error: 'اختار تقييم من ١ لـ٥' };
  }
  const comment = params.comment.trim();
  if (comment.length > 2000) return { ok: false, error: 'الرأي طويل — اختصره شوية', field: 'comment' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'سجّل دخولك الأول' };

  const { error } = await supabase.from('customer_feedback').insert({
    user_id: user.id,
    line: params.line,
    rating: params.rating,
    comment: comment || null,
  });
  if (error) {
    console.error('submitFeedback', error);
    // الرفض الوحيد المتوقع: سياسة «استعمل الخط ده».
    return {
      ok: false,
      error: `تقدر تكتب رأيك في «${FEEDBACK_LINE_LABELS[params.line]}» بعد أول طلب أو اشتراك فيها.`,
    };
  }

  await notifyAdmins({
    title: `رأي جديد في «${FEEDBACK_LINE_LABELS[params.line]}» — ${'★'.repeat(params.rating)}`,
    message: comment ? comment.slice(0, 140) : undefined,
    link: FEEDBACK_ADMIN_HREF[params.line],
  });

  revalidatePath('/account/feedback');
  revalidatePath(FEEDBACK_ADMIN_HREF[params.line]);
  return { ok: true };
}

/** «اتقرا» — عشان الجديد يبان لوحده. */
export async function setFeedbackSeen(id: string, seen: boolean): Promise<Result> {
  let admin;
  try {
    admin = await requireAdmin('canManageSupport');
  } catch {
    return { ok: false, error: 'غير مصرح' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_feedback')
    .update({
      status: seen ? 'seen' : 'new',
      handled_at: seen ? new Date().toISOString() : null,
      handled_by: seen ? admin.id : null,
    })
    .eq('id', id)
    .select('line')
    .maybeSingle();
  if (error || !data) return { ok: false, error: 'تعذّر الحفظ — جرّب تاني' };
  revalidatePath(FEEDBACK_ADMIN_HREF[data.line]);
  return { ok: true };
}
