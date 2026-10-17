'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { notifyAdmins } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { joinRequestRoleLabel, joinNextStep, JOIN_ROLE_LABELS } from '@/lib/join-roles';
import { normalizePhone, isValidPhone, PHONE_ERROR } from '@/lib/phone';

export type JoinRequestResult =
  | { ok: true; nextHref?: string; nextLabel?: string }
  | { ok: false; error: string };

/**
 * البتّ في طلب انضمام.
 *
 * الزرّان في شاشة الإدارة كانوا بلا أي معالج، فالطلب كان بيفضل
 * `pending` مهما ضغطت الإدارة.
 */
export async function setJoinRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected',
): Promise<JoinRequestResult> {
  // ⚠️ `requireAdmin` بترمي — ورسالتها كانت بتوصل ممسوحة (قاعدة «هـ»).
  let admin;
  try {
    admin = await requireAdmin('canManageSupport', 'غير مصرح لك بإدارة طلبات الانضمام');
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'غير مصرح لك بإدارة طلبات الانضمام',
    };
  }

  const supabase = await createClient();

  // ⚠️ **`.eq('status','pending')` + `.select()` مع بعض** (قاعدة «و»).
  //
  //    من غيرهم: `UPDATE` على صف مش موجود **بينجح** وبيرجّع صفر صفوف،
  //    فالشاشة تقول «تم» وما حصلش حاجة. وأخطر من كده إن القبول مرتين
  //    كان هيعدّي — ودي شاشة بتعمل حسابات، فالتكرار معناه حسابين.
  const { data: updated, error } = await supabase
    .from('join_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id, applicant_name, email, requested_role, message')
    .maybeSingle();

  if (error) {
    console.error('Error updating join request', error);
    return { ok: false, error: 'تعذّر تحديث حالة الطلب' };
  }

  if (!updated) {
    // صفر صفوف: يا إما الطلب مش موجود، يا إما حد بتّ فيه قبلك. بنسأل
    // عشان الرسالة تقول السبب بدل «تعذّر» المبهمة.
    const { data: current } = await supabase
      .from('join_requests')
      .select('status')
      .eq('id', requestId)
      .maybeSingle();

    if (!current) return { ok: false, error: 'الطلب ده مش موجود' };
    return {
      ok: false,
      error:
        current.status === 'approved'
          ? 'الطلب ده اتقبل قبل كده. لو الحساب ما اتعملش، اعمله من شاشة المدربين أو المستخدمين.'
          : 'الطلب ده اترفض قبل كده.',
    };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: status === 'approved' ? 'join_request_approved' : 'join_request_rejected',
    entityType: 'JoinRequest',
    entityId: requestId,
  });

  revalidatePath(`/dashboard/admin/join-requests/${requestId}`);
  revalidatePath('/dashboard/admin/join-requests');
  revalidatePath('/dashboard/admin');

  if (status !== 'approved') return { ok: true };

  return {
    ok: true,
    ...joinNextStep(
      updated.requested_role ?? '',
      updated.applicant_name ?? '',
      updated.email ?? '',
      updated.message ?? null,
    ),
  };
}

/**
 * شخص بيقدّم طلب انضمام للمنصة.
 *
 * النموذج العام كان `<form>` بلا `action` وزرار إرساله `type="button"`:
 * كل طلب — مدربين ورسامين وكُتّاب — كان بيضيع لحظة ما المتقدّم يدوس.
 */
// عامّة عن قصد: أي زائر يقدم طلب انضمام. قاعدة البيانات بتفرض
// `status = 'pending'` في قاعدة «Anyone can apply to join»، فمحدش
// يقدر يقدّم طلبًا مقبولًا من البداية.
export async function submitJoinRequest(params: {
  applicantName: string;
  email: string;
  phone: string;
  requestedRole: string;
  portfolioUrl: string;
  message: string;
}): Promise<JoinRequestResult> {
  const applicantName = params.applicantName.trim();
  const email = params.email.trim().toLowerCase();

  // ⚠️ بترجّع بدل ما ترمي (قاعدة «هـ»): Next بيمسح نص أي خطأ مرميّ في
  //    النسخة المنشورة، فرسايل زي «اكتب اسمك» مكانتش بتوصل للمتقدّم
  //    أصلًا — كان بيشوف نصًّا إنجليزيًا عامًّا على نموذج عربي.
  if (!applicantName) return { ok: false, error: 'اكتب اسمك' };
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'اكتب بريدًا إلكترونيًا صحيحًا' };
  }
  // نفس القايمة اللي في الفورم وفي قيد القاعدة (ملف 10).
  if (!(params.requestedRole in JOIN_ROLE_LABELS)) {
    return { ok: false, error: 'اختر الدور المطلوب' };
  }

  // ⚠️ **`type="tel"` مش بيمنع الحروف** — بيغيّر لوحة مفاتيح الموبايل
  //    وبس. فالإدارة كانت بتفتح طلبًا عليه «تليفون» مكتوب فيه كلام،
  //    وماتقدرش تتواصل — والمتقدّم فاكر إنه سجّل صح.
  const phone = normalizePhone(params.phone);
  if (params.phone?.trim() && !isValidPhone(params.phone)) {
    return { ok: false, error: PHONE_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('join_requests').insert({
    applicant_name: applicantName,
    requested_role: params.requestedRole,
    email,
    phone: phone || null,
    portfolio_url: params.portfolioUrl.trim() || null,
    message: params.message.trim() || null,
    status: 'pending',
  });

  if (error) {
    console.error('Error submitting join request', error);
    return { ok: false, error: 'تعذّر إرسال الطلب، برجاء المحاولة مرة أخرى' };
  }

  // ⚠️ كان مكتوب **مرتين** بالنص، فالإدارة كانت بتاخد إشعارين متطابقين
  //    على كل طلب. والإشعار المكرر بيدرّب الناس على تجاهل الإشعارات.
  await notifyAdmins({
    event: 'join_request',
    title: 'طلب انضمام جديد',
    message: `${applicantName} قدّم طلب انضمام (${joinRequestRoleLabel(params.requestedRole)}).`,
    link: '/dashboard/admin/join-requests',
  });

  revalidatePath('/dashboard/admin/join-requests');
  revalidatePath('/dashboard/admin');
  return { ok: true };
}

/**
 * رسالة من الإدارة على طلب انضمام.
 *
 * ⚠️ **النقاش مش قرار** — الرسالة مابتغيّرش حالة الطلب. الطلب يفضل
 *    `pending` لحد ما الإدارة تقبل أو ترفض فعلًا.
 */
export async function postJoinRequestMessage(
  requestId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let admin;
  try {
    admin = await requireAdmin('canManageSupport', 'غير مصرح لك بإدارة طلبات الانضمام');
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'غير مصرح لك بإدارة طلبات الانضمام',
    };
  }

  const text = body.trim();
  if (!text) return { ok: false, error: 'اكتب الرسالة الأول' };
  if (text.length > 4000) return { ok: false, error: 'الرسالة طويلة أوي — اختصرها.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('join_request_messages')
    .insert({ request_id: requestId, author: 'admin', author_profile_id: admin.id, body: text })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('postJoinRequestMessage', error);
    if (error.code === '42P01') {
      return { ok: false, error: 'النقاش محتاج ملف القاعدة 20261017010000 يتشغّل الأول' };
    }
    return { ok: false, error: `تعذّر إرسال الرسالة (${error.code ?? 'خطأ'})` };
  }
  // ⚠️ `INSERT` على صفر صفوف بينجح لو سياسة رفضت (قاعدة «و»).
  if (!data) return { ok: false, error: 'الرسالة مروّحتش للقاعدة — راجع الصلاحيات.' };

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'join_request_message',
    entityType: 'JoinRequest',
    entityId: requestId,
  });

  revalidatePath(`/dashboard/admin/join-requests/${requestId}`);
  return { ok: true };
}
