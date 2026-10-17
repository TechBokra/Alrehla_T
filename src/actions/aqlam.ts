'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireUser } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { refreshAqlam } from '@/lib/aqlam/revalidate';
import { refreshPublicPages } from '@/lib/revalidate';
import { parseBirthDate } from '@/lib/aqlam/age';
import { aqlamErrorMessage, parseRpcResult } from '@/lib/aqlam/errors';
import {
  AQLAM_LIMITS,
  isAqlamReaction,
  isReportReason,
  validateCommentBody,
  validateEditInput,
  validateGuardianReason,
  validatePublishInput,
  validateWriterProfileInput,
} from '@/lib/aqlam/post';
import type { AqlamAgeGroup } from '@/lib/aqlam/age';

/**
 * عمليات «أقلام الرحلة».
 *
 * ⚠️ **الحارس الحقيقي في القاعدة** (دوال `aqlam_*` + RLS). اللي هنا: رسالة
 * عربي واضحة، وفلتر بيانات التواصل بشكله الكامل، وتحديث صفحات /aqlam بس
 * (`refreshAqlam` — مش `refreshPublicPages` اللي بتمسح الموقع كله).
 *
 * كل دالة بترجّع `{ ok, … }` ومابترميش (قاعدة «هـ»).
 */

export type AqlamActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; field?: string; needsSignIn?: boolean };

const GENERIC = aqlamErrorMessage(undefined);
const NEED_SIGN_IN = 'سجّل دخولك الأول.';

/** مستخدم مسجّل دخول — أو نتيجة خطأ جاهزة للإرجاع. */
async function signedIn() {
  try {
    return { ok: true as const, user: await requireUser() };
  } catch {
    return { ok: false as const, error: NEED_SIGN_IN, needsSignIn: true as const };
  }
}

async function adminOnly(message: string) {
  try {
    return { ok: true as const, user: await requireAdmin('canManageContent', message) };
  } catch {
    return { ok: false as const, error: message };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');

// ── النشر ────────────────────────────────────────────────────────────────────

/**
 * نشر نسخة ثابتة من نص. بعد النجاح بيحوّل لـ«ملفي» (والنص بتاعك ظاهر هناك
 * بحالته: منشور / بانتظار ولي الأمر).
 *
 * تاريخ الميلاد بيتطلب **مرة واحدة** لحساب مستقل جديد، والقاعدة هي اللي
 * بتحسب السنّ والفئة — مفيش فئة بتتبعت من النموذج.
 */
export async function publishPost(formData: FormData): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { data: statusRaw, error: statusError } = await supabase.rpc('aqlam_my_status');
  const status = statusError ? null : parseRpcResult(statusRaw);
  if (!status || !status.ok) {
    return { ok: false, error: status && !status.ok ? status.error : GENERIC };
  }
  const s = status.data;
  if (s.enabled !== true) return { ok: false, error: aqlamErrorMessage('disabled') };
  if (s.suspended === true) return { ok: false, error: aqlamErrorMessage('suspended') };
  if (s.publishing_locked === true) return { ok: false, error: aqlamErrorMessage('guardian_locked') };

  // الفئة: من القاعدة لو معروفة، وإلا من تاريخ الميلاد اللي اتكتب دلوقتي.
  let group: AqlamAgeGroup;
  let birthDate: string | null = null;
  if (s.needs_birthdate === true) {
    const birth = parseBirthDate(str(formData.get('birthDate')));
    if (!birth.ok) return { ok: false, error: birth.error, field: 'birthDate' };
    group = '12_plus';
    birthDate = birth.iso;
  } else {
    group = s.age_group === '12_plus' ? '12_plus' : 'under_12';
  }

  if (formData.get('consent') !== 'on') {
    return { ok: false, error: 'لازم توافق على شروط النشر الأول.', field: 'consent' };
  }

  const input = validatePublishInput(
    {
      title: formData.get('title'),
      body: formData.get('body'),
      category: formData.get('category'),
      nameMode: formData.get('nameMode'),
      penName: formData.get('penName'),
      allowIndexing: formData.get('allowIndexing') === 'on',
      commentsEnabled: formData.get('commentsEnabled') === 'on',
      sourceDocumentId: formData.get('sourceDocumentId'),
    },
    group,
  );
  if (!input.ok) return { ok: false, error: input.error, field: input.field };
  const v = input.value;

  const { data, error } = await supabase.rpc('aqlam_publish_post', {
    p_title: v.title,
    p_body: v.body,
    p_category: v.category,
    p_name_mode: v.nameMode,
    p_pen_name: v.penName,
    p_allow_indexing: v.allowIndexing,
    p_comments_enabled: v.commentsEnabled,
    p_source_document_id: v.sourceDocumentId,
    p_birth_date: birthDate,
    // نسخة الشروط اللي وافق عليها — بتتسجّل مع النص وبتتغيّر لما الشروط تتغيّر.
    p_consent_version: str(formData.get('consentVersion')) || 'v1',
  });
  if (error) {
    console.error('aqlam_publish_post failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) {
    return {
      ok: false,
      error: out.error,
      field:
        out.code === 'contact_info' ? 'body' : out.code === 'birthdate_required' ? 'birthDate' : undefined,
    };
  }

  const id = String(out.data.id ?? '');
  const finalStatus = String(out.data.status ?? '');
  if (finalStatus === 'published') refreshAqlam(id);
  redirect(`/aqlam/me?posted=${encodeURIComponent(finalStatus)}`);
}

/**
 * تعديل نص الكاتب نفسه. القاعدة هي اللي بتقرر الوضع بعد التعديل:
 * ١٢+ منشور يفضل منشور («عُدّل»)، وأقل من ١٢ يرجع لولي الأمر.
 */
export async function updatePost(formData: FormData): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const postId = str(formData.get('postId'));
  if (!postId) return { ok: false, error: aqlamErrorMessage('invalid') };

  const supabase = await createClient();
  const { data: statusRaw, error: statusError } = await supabase.rpc('aqlam_my_status');
  const status = statusError ? null : parseRpcResult(statusRaw);
  if (!status || !status.ok) {
    return { ok: false, error: status && !status.ok ? status.error : GENERIC };
  }
  const group: AqlamAgeGroup = status.data.age_group === '12_plus' ? '12_plus' : 'under_12';

  const input = validateEditInput(
    {
      title: formData.get('title'),
      body: formData.get('body'),
      category: formData.get('category'),
      allowIndexing: formData.get('allowIndexing') === 'on',
      commentsEnabled: formData.get('commentsEnabled') === 'on',
    },
    group,
  );
  if (!input.ok) return { ok: false, error: input.error, field: input.field };
  const v = input.value;

  const { data, error } = await supabase.rpc('aqlam_update_post', {
    p_post: postId,
    p_title: v.title,
    p_body: v.body,
    p_category: v.category,
    p_allow_indexing: v.allowIndexing,
    p_comments_enabled: v.commentsEnabled,
  });
  if (error) {
    console.error('aqlam_update_post failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) {
    return { ok: false, error: out.error, field: out.code === 'contact_info' ? 'body' : undefined };
  }
  refreshAqlam(postId);
  redirect(`/aqlam/me?edited=${encodeURIComponent(String(out.data.status ?? ''))}`);
}

/** اسم القلم والنبذة وصفحة الكاتب العامة (اختيارية، ١٢+). */
export async function saveWriterProfile(formData: FormData): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const input = validateWriterProfileInput({
    penName: formData.get('penName'),
    bio: formData.get('bio'),
    isPublic: formData.get('isPublic') === 'on',
  });
  if (!input.ok) return { ok: false, error: input.error, field: input.field };
  const v = input.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_set_writer_profile', {
    p_pen_name: v.penName,
    p_bio: v.bio,
    p_public: v.isPublic,
  });
  if (error) {
    console.error('aqlam_set_writer_profile failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) {
    return {
      ok: false,
      error: out.error,
      field: out.code === 'contact_info' ? 'bio' : out.code === 'pen_name_required' ? 'penName' : undefined,
    };
  }
  const slug = typeof out.data.slug === 'string' ? out.data.slug : null;
  refreshAqlam(undefined, slug);
  return { ok: true, message: 'اتحفظ ملفك.' };
}

/** «شيل»: الكاتب يشيل نصه. */
export async function removeMyPost(postId: string): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_remove_own_post', { p_post: postId });
  if (error) {
    console.error('aqlam_remove_own_post failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  refreshAqlam(postId);
  return { ok: true };
}

// ── التفاعل ──────────────────────────────────────────────────────────────────

export type ReactionResult =
  | { ok: true; reactionCount: number }
  | { ok: false; error: string; needsSignIn?: boolean };

export async function setReaction(
  postId: string,
  kind: string,
  on: boolean,
): Promise<ReactionResult> {
  if (!isAqlamReaction(kind)) return { ok: false, error: aqlamErrorMessage('invalid') };
  const auth = await signedIn();
  if (!auth.ok) return { ok: false, error: auth.error, needsSignIn: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_set_reaction', {
    p_post: postId,
    p_kind: kind,
    p_on: on,
  });
  if (error) {
    console.error('aqlam_set_reaction failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  // العدّاد على الصفحة بيتحدّث من الكاش خلال دقيقة (`revalidate`)؛ مفيش
  // تحديث للصفحة مع كل ملصق عشان ما نمسحش الكاش مع كل ضغطة.
  return { ok: true, reactionCount: Number(out.data.reaction_count ?? 0) };
}

/** الملصقات اللي الحساب الحالي ضغطها على نص (فاضية للزائر). */
export async function getMyReactions(postId: string): Promise<string[]> {
  const auth = await signedIn();
  if (!auth.ok) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('aqlam_reactions')
    .select('kind')
    .eq('post_id', postId)
    .eq('user_id', auth.user.id);
  return (data ?? []).map((r) => r.kind);
}

export async function addComment(postId: string, body: string): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const text = validateCommentBody(body);
  if (!text.ok) return { ok: false, error: text.error, field: text.field };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_add_comment', { p_post: postId, p_body: text.value });
  if (error) {
    console.error('aqlam_add_comment failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  refreshAqlam(postId);
  return { ok: true, message: 'تعليقك اتنشر.' };
}

export async function reportContent(
  targetType: 'post' | 'comment',
  targetId: string,
  reason: string,
  details?: string,
): Promise<AqlamActionResult> {
  if ((targetType !== 'post' && targetType !== 'comment') || !isReportReason(reason)) {
    return { ok: false, error: aqlamErrorMessage('invalid') };
  }
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details?.trim() ? details.trim().slice(0, 500) : undefined,
  });
  if (error) {
    console.error('aqlam_report failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  // لو البلاغ كمّل التلاتة واتخبّى تلقائيًا، الصفحات تتحدّث.
  if (out.data.auto_hidden === true) refreshAqlam();
  return { ok: true, message: 'وصلنا بلاغك. شكرًا.' };
}

// ── ولي الأمر ────────────────────────────────────────────────────────────────

export async function guardianDecide(postId: string, approve: boolean): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_guardian_decide', {
    p_post: postId,
    p_approve: approve,
  });
  if (error) {
    console.error('aqlam_guardian_decide failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  revalidatePath('/account/family/aqlam');
  return { ok: true };
}

/** نفس `guardianDecide` بس لنموذج (زرارين `decision` = approve | reject). */
export async function guardianDecideForm(formData: FormData): Promise<AqlamActionResult> {
  const decision = str(formData.get('decision'));
  if (decision !== 'approve' && decision !== 'reject') {
    return { ok: false, error: aqlamErrorMessage('invalid') };
  }
  return guardianDecide(str(formData.get('postId')), decision === 'approve');
}

/** الحالة الحالية لقفل ابن (غياب الصف = مفتوح). بتتقرا بصلاحية ولي الأمر (RLS). */
async function currentLock(supabase: Awaited<ReturnType<typeof createClient>>, childId: string) {
  const { data } = await supabase
    .from('aqlam_guardian_settings')
    .select('publishing_allowed,comments_allowed')
    .eq('child_id', childId)
    .maybeSingle();
  return {
    publishingAllowed: data?.publishing_allowed ?? true,
    commentsAllowed: data?.comments_allowed ?? true,
  };
}

/**
 * قفل النشر (فوري). قفل التعليقات **مش من هنا**: بطلب للإدارة
 * (`requestCommentsLock`). التعليقات بتتبعت بحالتها الحالية عشان القاعدة
 * ماتعتبرهاش تغيير.
 */
export async function saveGuardianSettings(formData: FormData): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const childId = str(formData.get('childId'));
  if (!childId) return { ok: false, error: aqlamErrorMessage('invalid') };
  const supabase = await createClient();
  const lock = await currentLock(supabase, childId);
  const { data, error } = await supabase.rpc('aqlam_set_guardian_settings', {
    p_child: childId,
    p_publishing_allowed: formData.get('publishingAllowed') === 'on',
    p_comments_allowed: lock.commentsAllowed,
  });
  if (error) {
    console.error('aqlam_set_guardian_settings failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  revalidatePath('/account/family/aqlam');
  return { ok: true };
}

/** فتح التعليقات تاني بعد القفل — فوري من غير الإدارة. */
export async function reopenGuardianComments(formData: FormData): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const childId = str(formData.get('childId'));
  if (!childId) return { ok: false, error: aqlamErrorMessage('invalid') };
  const supabase = await createClient();
  const lock = await currentLock(supabase, childId);
  const { data, error } = await supabase.rpc('aqlam_set_guardian_settings', {
    p_child: childId,
    p_publishing_allowed: lock.publishingAllowed,
    p_comments_allowed: true,
  });
  if (error) {
    console.error('aqlam_set_guardian_settings (reopen) failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  revalidatePath('/account/family/aqlam');
  return { ok: true, message: 'اتفتحت التعليقات.' };
}

/** طلب قفل التعليقات لابن — للإدارة مع السبب. */
export async function requestCommentsLock(formData: FormData): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const childId = str(formData.get('childId'));
  if (!childId) return { ok: false, error: aqlamErrorMessage('invalid') };
  const v = validateGuardianReason(formData.get('reason'));
  if (!v.ok) return { ok: false, error: v.error, field: 'reason' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_request_comments_lock', {
    p_child: childId,
    p_reason: v.reason,
  });
  if (error) {
    console.error('aqlam_request_comments_lock failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  revalidatePath('/account/family/aqlam');
  revalidatePath('/dashboard/admin/aqlam');
  return { ok: true, message: 'اتبعت الطلب للإدارة. هنبلّغك بالقرار.' };
}

/** ولي الأمر يسحب طلبه قبل قرار الإدارة. */
export async function cancelGuardianRequest(formData: FormData): Promise<AqlamActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const requestId = str(formData.get('requestId'));
  if (!UUID_RE.test(requestId)) return { ok: false, error: aqlamErrorMessage('invalid') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_cancel_guardian_request', { p_request: requestId });
  if (error) {
    console.error('aqlam_cancel_guardian_request failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  revalidatePath('/account/family/aqlam');
  revalidatePath('/dashboard/admin/aqlam');
  return { ok: true };
}

// ── الإدارة ──────────────────────────────────────────────────────────────────

const POST_ACTIONS = ['approve', 'reject', 'hide', 'restore', 'remove', 'feature', 'unfeature'] as const;
const COMMENT_ACTIONS = ['hide', 'restore', 'remove'] as const;

export async function moderatePost(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك بمراجعة أقلام الرحلة');
  if (!auth.ok) return auth;
  const postId = str(formData.get('postId'));
  const action = str(formData.get('decision'));
  if (!postId || !(POST_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: aqlamErrorMessage('invalid') };
  }
  const reason = str(formData.get('reason')).trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_moderate_post', {
    p_post: postId,
    p_action: action,
    p_reason: reason || undefined,
  });
  if (error) {
    console.error('aqlam_moderate_post failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };

  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: `aqlam_post_${action}`,
    entityType: 'AqlamPost',
    entityId: postId,
    metadata: reason ? { reason } : undefined,
  });
  refreshAqlam(postId);
  revalidatePath('/dashboard/admin/aqlam');
  return { ok: true };
}

export async function moderateComment(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك بمراجعة أقلام الرحلة');
  if (!auth.ok) return auth;
  const commentId = str(formData.get('commentId'));
  const postId = str(formData.get('postId'));
  const action = str(formData.get('decision'));
  if (!commentId || !(COMMENT_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: aqlamErrorMessage('invalid') };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_moderate_comment', {
    p_comment: commentId,
    p_action: action,
  });
  if (error) {
    console.error('aqlam_moderate_comment failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };

  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: `aqlam_comment_${action}`,
    entityType: 'AqlamComment',
    entityId: commentId,
  });
  refreshAqlam(postId || undefined);
  revalidatePath('/dashboard/admin/aqlam');
  return { ok: true };
}

export async function handleReport(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك بمراجعة أقلام الرحلة');
  if (!auth.ok) return auth;
  const reportId = str(formData.get('reportId'));
  const decision = str(formData.get('decision'));
  if (!reportId || (decision !== 'actioned' && decision !== 'dismissed')) {
    return { ok: false, error: aqlamErrorMessage('invalid') };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_handle_report', {
    p_report: reportId,
    p_status: decision,
  });
  if (error) {
    console.error('aqlam_handle_report failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: `aqlam_report_${decision}`,
    entityType: 'AqlamReport',
    entityId: reportId,
  });
  revalidatePath('/dashboard/admin/aqlam');
  return { ok: true };
}

/** قرار الإدارة على طلب ولي الأمر: approve | reject (الرفض بملاحظة إجبارية). */
export async function decideGuardianRequest(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك بمراجعة طلبات أولياء الأمور');
  if (!auth.ok) return auth;
  const requestId = str(formData.get('requestId'));
  const decision = str(formData.get('decision'));
  if (!UUID_RE.test(requestId) || (decision !== 'approve' && decision !== 'reject')) {
    return { ok: false, error: aqlamErrorMessage('invalid') };
  }
  const note = str(formData.get('note')).trim();
  if (decision === 'reject' && !note) {
    return { ok: false, error: aqlamErrorMessage('note_required'), field: 'note' };
  }
  if (note.length > AQLAM_LIMITS.adminNoteMax) {
    return { ok: false, error: aqlamErrorMessage('invalid'), field: 'note' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_decide_guardian_request', {
    p_request: requestId,
    p_approve: decision === 'approve',
    p_note: note || undefined,
  });
  if (error) {
    console.error('aqlam_decide_guardian_request failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: `aqlam_guardian_request_${decision}`,
    entityType: 'AqlamGuardianRequest',
    entityId: requestId,
  });
  revalidatePath('/dashboard/admin/aqlam');
  revalidatePath('/account/family/aqlam');
  return { ok: true };
}

export async function sanctionUser(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك بتوقيع عقوبات أقلام الرحلة');
  if (!auth.ok) return auth;
  const userId = str(formData.get('userId'));
  const kind = str(formData.get('kind'));
  const reason = str(formData.get('reason')).trim();
  if (!UUID_RE.test(userId)) {
    return { ok: false, error: 'الحساب مش متحدد. ابحث عنه في «الحسابات» واختاره من النتايج.' };
  }
  if (!reason) {
    return { ok: false, error: 'اكتب سبب العقوبة.', field: 'reason' };
  }
  if (!['warning', 'suspension_7d', 'permanent'].includes(kind)) {
    return { ok: false, error: 'اختار نوع العقوبة.', field: 'kind' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_sanction_user', {
    p_user: userId,
    p_kind: kind,
    p_reason: reason,
  });
  if (error) {
    console.error('aqlam_sanction_user failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'aqlam_user_sanctioned',
    entityType: 'AqlamSanction',
    entityId: userId,
    metadata: { kind, reason },
  });
  // الإيقاف بيخفي رابط صفحة الكاتب من الكاش العام.
  refreshAqlam();
  revalidatePath('/dashboard/admin/aqlam');
  return { ok: true };
}

/** رفع عقوبة (إيقاف) قبل موعدها. */
export async function liftSanction(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك برفع عقوبات أقلام الرحلة');
  if (!auth.ok) return auth;
  const sanctionId = str(formData.get('sanctionId'));
  if (!UUID_RE.test(sanctionId)) return { ok: false, error: aqlamErrorMessage('invalid') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_lift_sanction', { p_sanction: sanctionId });
  if (error) {
    console.error('aqlam_lift_sanction failed', error);
    return { ok: false, error: GENERIC };
  }
  const out = parseRpcResult(data);
  if (!out.ok) return { ok: false, error: out.error };
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'aqlam_sanction_lifted',
    entityType: 'AqlamSanction',
    entityId: sanctionId,
  });
  // رجوع صفحة الكاتب/نصوصه للعرض بعد الرفع.
  refreshAqlam();
  revalidatePath('/dashboard/admin/aqlam');
  return { ok: true };
}

type AqlamSettingsPatch = { mode?: 'off' | 'pilot' | 'public'; allowlist?: string[] };

/**
 * يدمج تغيير أقلام الرحلة جوّه صف `general` (دمج مش استبدال — باقي الإعدادات
 * بتفضل زي ما هي). اللي مش في `patch` بيفضل زي ما هو.
 */
async function writeAqlamSettings(
  patch: AqlamSettingsPatch,
  actor: { id: string; fullName: string },
  action: string,
): Promise<AqlamActionResult> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'general')
    .single();
  const current = (existing?.value ?? {}) as Record<string, unknown>;
  const next = {
    ...current,
    ...(patch.mode ? { aqlamMode: patch.mode } : {}),
    ...(patch.allowlist ? { aqlamAllowlist: Array.from(new Set(patch.allowlist)) } : {}),
  };

  const { data: saved, error } = await supabase
    .from('site_settings')
    .upsert({ key: 'general', value: next as never }, { onConflict: 'key' })
    .select('key');
  if (error) {
    console.error('Error saving aqlam settings', error);
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'الحفظ مروّحش للقاعدة — صلاحيات جدول الإعدادات مش سامحة بالكتابة.' };
  }

  await logAuditAction({
    actorProfileId: actor.id,
    actorName: actor.fullName,
    action,
    entityType: 'SiteSettings',
    entityId: 'general',
    metadata: {
      aqlamMode: next.aqlamMode,
      allowlistCount: Array.isArray(next.aqlamAllowlist) ? next.aqlamAllowlist.length : 0,
    },
  });
  revalidatePath('/dashboard/admin/aqlam');
  // تغيير الحالة أو القايمة بيغيّر رابط القائمة/اللي يقدر ينشر في كل الصفحات —
  // الاستثناء المقصود لتحديث الموقع كله (نادر وبيد الإدارة، مش مع كل نشر).
  refreshPublicPages();
  return { ok: true, message: 'اتحفظ.' };
}

function currentAllowlist(value: unknown): string[] {
  const list = (value as { aqlamAllowlist?: unknown } | null)?.aqlamAllowlist;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
}

/** حالة التشغيل (مقفول/تجريبي/عام). القايمة بتتدار لوحدها من `setAllowlistMember`. */
export async function saveAqlamSettings(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك بتعديل إعدادات الموقع');
  if (!auth.ok) return auth;

  const mode = str(formData.get('mode'));
  if (mode !== 'off' && mode !== 'pilot' && mode !== 'public') {
    return { ok: false, error: 'اختار حالة التشغيل.', field: 'mode' };
  }
  return writeAqlamSettings({ mode }, auth.user, 'aqlam_settings_updated');
}

/** إضافة/شيل حساب من قايمة التجربة (الاختيار من نتايج البحث بالاسم، مش بكتابة رقم). */
export async function setAllowlistMember(formData: FormData): Promise<AqlamActionResult> {
  const auth = await adminOnly('غير مصرح لك بتعديل إعدادات الموقع');
  if (!auth.ok) return auth;

  const userId = str(formData.get('userId'));
  const op = str(formData.get('op'));
  if (!UUID_RE.test(userId) || (op !== 'add' && op !== 'remove')) {
    return { ok: false, error: aqlamErrorMessage('invalid') };
  }
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'general')
    .single();
  const list = currentAllowlist(existing?.value);
  const next = op === 'add' ? [...list, userId] : list.filter((id) => id !== userId);
  return writeAqlamSettings({ allowlist: next }, auth.user, `aqlam_allowlist_${op}`);
}
