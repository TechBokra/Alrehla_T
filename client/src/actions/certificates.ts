'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { paperRequestProblem, participantNameProblem } from '@/lib/certificates';

/**
 * شهادات الإتمام. كل تغيير بدالة في القاعدة (`course_certificate_*`) بتتأكد
 * من الصلاحية والحالة وبتفتح/تنقل/تقفل المهمة وبتبعت إشعار ولي الأمر — الكود
 * هنا بيفحص الإدخال ويرجّع الرسالة. بترجّع ولا بترمي (قاعدة «هـ»).
 */
export type CertificateResult = { ok: true } | { ok: false; error: string; field?: string };

const DENIED = 'الشهادات محتاجة صلاحية «إدارة الحجوزات»';
const ADMIN_PATH = '/dashboard/admin/bookings/certificates';

/** رسالة القاعدة عربية ومفهومة (RAISE) — غير كده رسالة عامة. */
function dbMessage(error: { message?: string; code?: string } | null, fallback: string): string {
  if (error?.code === '42883' || error?.code === '42P01') return 'الشهادات محتاجة ملف القاعدة 20261107120000 يتشغّل الأول';
  const m = error?.message?.trim() ?? '';
  return /[؀-ۿ]/.test(m) ? m : fallback;
}

async function admin() {
  try {
    return await requireAdmin('canManageBookings', DENIED);
  } catch {
    return null;
  }
}

function refresh() {
  revalidatePath(ADMIN_PATH);
  revalidatePath('/dashboard/admin/tasks');
  revalidatePath('/account/bookings');
}

/** إنشاء يدوي من صفحة الحجز (لو الجلسات ماتعلّمتش «اكتملت»). */
export async function createCertificate(subscriptionId: string): Promise<CertificateResult> {
  const user = await admin();
  if (!user) return { ok: false, error: DENIED };
  const supabase = await createClient();
  const { error } = await supabase.rpc('course_certificate_create', { p_subscription: subscriptionId });
  if (error) {
    console.error('createCertificate', error);
    return { ok: false, error: dbMessage(error, 'تعذّر إنشاء الشهادة') };
  }
  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'certificate_created',
    entityType: 'course_subscription',
    entityId: subscriptionId,
  });
  refresh();
  revalidatePath(`/dashboard/admin/bookings/${subscriptionId}`);
  return { ok: true };
}

export async function issueCertificate(id: string, participantName: string): Promise<CertificateResult> {
  const user = await admin();
  if (!user) return { ok: false, error: DENIED };
  const problem = participantNameProblem(participantName);
  if (problem) return { ok: false, error: problem, field: 'participantName' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('course_certificate_issue', {
    p_id: id,
    p_participant_name: participantName.trim(),
  });
  if (error) {
    console.error('issueCertificate', error);
    return { ok: false, error: dbMessage(error, 'تعذّر إصدار الشهادة') };
  }
  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'certificate_issued',
    entityType: 'certificate',
    entityId: id,
    metadata: { certificateNo: data, participantName: participantName.trim() },
  });
  refresh();
  return { ok: true };
}

export async function shipCertificate(id: string, tracking: string): Promise<CertificateResult> {
  const user = await admin();
  if (!user) return { ok: false, error: DENIED };
  const supabase = await createClient();
  const { error } = await supabase.rpc('course_certificate_ship', { p_id: id, p_tracking: tracking.trim() || null });
  if (error) {
    console.error('shipCertificate', error);
    return { ok: false, error: dbMessage(error, 'تعذّر تسجيل الشحن') };
  }
  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'certificate_shipped',
    entityType: 'certificate',
    entityId: id,
    metadata: { tracking: tracking.trim() || null },
  });
  refresh();
  return { ok: true };
}

export async function deliverCertificate(id: string): Promise<CertificateResult> {
  const user = await admin();
  if (!user) return { ok: false, error: DENIED };
  const supabase = await createClient();
  const { error } = await supabase.rpc('course_certificate_deliver', { p_id: id });
  if (error) {
    console.error('deliverCertificate', error);
    return { ok: false, error: dbMessage(error, 'تعذّر تسجيل التسليم') };
  }
  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'certificate_delivered',
    entityType: 'certificate',
    entityId: id,
  });
  refresh();
  return { ok: true };
}

/** ولي الأمر يطلب نسخة ورقية بعنوانه. */
export async function requestPaperCertificate(formData: FormData): Promise<CertificateResult> {
  const id = String(formData.get('id') ?? '');
  const input = {
    recipientName: String(formData.get('recipientName') ?? ''),
    recipientPhone: String(formData.get('recipientPhone') ?? ''),
    addressLine: String(formData.get('addressLine') ?? ''),
    city: String(formData.get('city') ?? ''),
    governorate: String(formData.get('governorate') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  };
  const problem = paperRequestProblem(input);
  if (problem) return { ok: false, error: problem.message, field: problem.field };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'سجّل الدخول الأول' };

  const { error } = await supabase.rpc('course_certificate_request_paper', {
    p_id: id,
    p_recipient_name: input.recipientName.trim(),
    p_recipient_phone: input.recipientPhone.trim(),
    p_address_line: input.addressLine.trim(),
    p_city: input.city.trim(),
    p_governorate: input.governorate.trim(),
    p_notes: input.notes.trim() || null,
  });
  if (error) {
    console.error('requestPaperCertificate', error);
    return { ok: false, error: dbMessage(error, 'تعذّر إرسال الطلب') };
  }
  refresh();
  return { ok: true };
}
