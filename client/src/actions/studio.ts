'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { hasAdminPermission } from '@/lib/utils';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { AGE_BANDS } from '@/lib/age-bands';
import {
  COST_KINDS,
  MAX_PAGE_NO,
  PAGE_STATUS_LABELS,
  PAGE_TARGET_MAX,
  PAGE_TARGET_MIN,
  QA_ITEMS,
  QA_SENSITIVE_ITEM,
  isHttpsUrl,
  isUuid,
  studioErrorMessage,
  type CostKind,
  type PageStatus,
} from '@/lib/studio';

/**
 * عمليات استوديو القصص.
 *
 * ⚠️ **الحارس الحقيقي محفّزات القاعدة + RLS** (ملف `story_studio_foundation`):
 *    مين يحرّك أنهي مرحلة، والشروط المسبقة، وتجميد النص المعتمد. اللي هنا
 *    رسالة عربي واضحة وتحقّق من المدخلات وسجل التدقيق — مش بديل عن القاعدة.
 *
 *    كل الكتابة بتمشي بجلسة المستخدم نفسه (مش مفتاح الخدمة)، فالقاعدة بتشوف
 *    مين بيعمل إيه. كل دالة بترجّع `{ ok, … }` ومابترميش.
 */

export type StudioActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

const NOT_ALLOWED = 'مالكش صلاحية للعملية دي.';

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');

async function worker() {
  try {
    return { ok: true as const, user: await requireAdmin('canWorkStudio', NOT_ALLOWED) };
  } catch {
    return { ok: false as const, error: NOT_ALLOWED };
  }
}

async function manager() {
  try {
    return { ok: true as const, user: await requireAdmin('canManageStudio', NOT_ALLOWED) };
  } catch {
    return { ok: false as const, error: NOT_ALLOWED };
  }
}

function refresh(projectId?: string) {
  revalidatePath('/dashboard/admin/studio');
  if (projectId) revalidatePath(`/dashboard/admin/studio/${projectId}`);
}

function dbFail(context: string, error: { code?: string | null; message?: string | null }): StudioActionResult {
  console.error(`studio:${context}`, error);
  return { ok: false, error: studioErrorMessage(error) };
}

async function audit(
  user: { id: string; fullName?: string },
  action: string,
  projectId: string,
  metadata?: Record<string, unknown>,
) {
  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action,
    entityType: 'StoryProject',
    entityId: projectId,
    metadata,
  });
}

function projectIdOf(formData: FormData): string | null {
  const id = str(formData.get('projectId'));
  return isUuid(id) ? id : null;
}

const BAD_PROJECT: StudioActionResult = { ok: false, error: 'المشروع غير معروف.' };

// ── التشغيل ──────────────────────────────────────────────────────────────────

/** تشغيل الاستوديو/إيقافه — مفتاح في صف `general` (مفيش استعلام زيادة في الموقع). */
export async function saveStudioMode(formData: FormData): Promise<StudioActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const mode = str(formData.get('mode'));
  if (mode !== 'on' && mode !== 'off') {
    return { ok: false, error: 'اختار حالة التشغيل.', field: 'mode' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'general').maybeSingle();
  const next = { ...((existing?.value ?? {}) as Record<string, unknown>), studioMode: mode };
  const { data: saved, error } = await supabase
    .from('site_settings')
    .upsert({ key: 'general', value: next as never }, { onConflict: 'key' })
    .select('key');
  if (error) return dbFail('saveStudioMode', error);
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'الحفظ مروّحش للقاعدة — صلاحيات جدول الإعدادات مش سامحة بالكتابة.' };
  }
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'studio_mode_updated',
    entityType: 'SiteSettings',
    entityId: 'general',
    metadata: { studioMode: mode },
  });
  refresh();
  revalidatePath('/dashboard/admin/studio/settings');
  // مفيش refreshPublicPages: الاستوديو في الإدارة بس ومابيغيّرش أي صفحة عامة.
  return { ok: true, message: mode === 'on' ? 'الاستوديو اتشغّل.' : 'الاستوديو اتقفل.' };
}

/** بدء مشروع يدويًا لبند طلب مدفوع (مثلًا طلبات اتدفعت قبل تشغيل الاستوديو). */
export async function startStudioProject(formData: FormData): Promise<StudioActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const itemId = str(formData.get('orderItemId'));
  if (!isUuid(itemId)) return { ok: false, error: 'بند الطلب غير معروف.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('story_start_project', { p_order_item: itemId });
  if (error) return dbFail('startStudioProject', error);
  if (data) await audit(auth.user, 'story_project_started', String(data), { orderItemId: itemId });
  refresh(data ? String(data) : undefined);
  const orderId = str(formData.get('orderId'));
  if (isUuid(orderId)) revalidatePath(`/dashboard/admin/orders/${orderId}`);
  return { ok: true, message: 'اتفتح مشروع القصة.' };
}

/** استيراد الطلبات المدفوعة اللي ماعندهاش مشروع (دفعت والاستوديو مقفول، أو قبل التفعيل). */
export async function backfillStudioProjects(): Promise<StudioActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('story_backfill_projects');
  if (error) return dbFail('backfillStudioProjects', error);
  const n = typeof data === 'number' ? data : 0;
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'story_backfill_run',
    entityType: 'StoryProject',
    entityId: 'backfill',
    metadata: { created: n },
  });
  refresh();
  revalidatePath('/dashboard/admin/studio/settings');
  return { ok: true, message: n > 0 ? `اتفتح ${n.toLocaleString('ar-EG')} مشروع.` : 'مفيش طلبات ناقصها مشروع.' };
}

// ── التوزيع والبيانات الأساسية ───────────────────────────────────────────────

/** التوزيع والموعد — مسؤول الإنتاج. */
export async function assignStudioProject(formData: FormData): Promise<StudioActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;

  const editorId = str(formData.get('editorId'));
  const artLeadId = str(formData.get('artLeadId'));
  const dueRaw = str(formData.get('dueAt'));
  if (editorId && !isUuid(editorId)) return { ok: false, error: 'المحرّر غير معروف.', field: 'editorId' };
  if (artLeadId && !isUuid(artLeadId)) return { ok: false, error: 'المشرف الفني غير معروف.', field: 'artLeadId' };
  let dueAt: string | null = null;
  if (dueRaw) {
    const d = new Date(`${dueRaw}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'الموعد مش مظبوط.', field: 'dueAt' };
    dueAt = d.toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_projects')
    .update({ editor_id: editorId || null, art_lead_id: artLeadId || null, due_at: dueAt })
    .eq('id', id);
  if (error) return dbFail('assignStudioProject', error);
  await audit(auth.user, 'story_project_assigned', id, { editorId: editorId || null, artLeadId: artLeadId || null, dueAt });
  refresh(id);
  return { ok: true, message: 'اتحفظ التوزيع.' };
}

/** بيانات المشروع: العمر، وعدد الصفحات، ووضع الوجه، والموضوع الحسّاس. */
export async function saveStudioBrief(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;

  const ageBand = str(formData.get('ageBand'));
  if (ageBand && !AGE_BANDS.some((b) => b.id === ageBand)) {
    return { ok: false, error: 'اختار فئة عمرية من القايمة.', field: 'ageBand' };
  }
  const pagesRaw = str(formData.get('pageTarget'));
  let pageTarget: number | null = null;
  if (pagesRaw) {
    const n = Number(pagesRaw);
    if (!Number.isInteger(n) || n < PAGE_TARGET_MIN || n > PAGE_TARGET_MAX) {
      return {
        ok: false,
        error: `عدد الصفحات بين ${PAGE_TARGET_MIN} و${PAGE_TARGET_MAX}.`,
        field: 'pageTarget',
      };
    }
    pageTarget = n;
  }
  const faceMode = str(formData.get('faceMode'));
  if (faceMode !== 'cartoon' && faceMode !== 'real') {
    return { ok: false, error: 'اختار وضع الوجه.', field: 'faceMode' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_projects')
    .update({
      age_band: ageBand || null,
      page_target: pageTarget,
      face_mode: faceMode,
      sensitive_topic: formData.get('sensitiveTopic') === 'on',
    })
    .eq('id', id);
  if (error) return dbFail('saveStudioBrief', error);
  await audit(auth.user, 'story_project_brief_saved', id, { ageBand: ageBand || null, pageTarget, faceMode });
  refresh(id);
  return { ok: true, message: 'اتحفظت البيانات.' };
}

/** تسجيل موافقة ولي الأمر على استخدام صورة الطفل (للوجه الحقيقي). */
export async function recordPhotoConsent(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;
  const note = str(formData.get('note'));
  if (note.length < 5) {
    return { ok: false, error: 'سجّل إزاي ومتى ولي الأمر وافق (مثلًا: رسالة واتساب بتاريخ كذا).', field: 'note' };
  }
  if (note.length > 1000) return { ok: false, error: 'الملاحظة طويلة (الحد ١٠٠٠ حرف).', field: 'note' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_projects')
    .update({ photo_consent_at: new Date().toISOString(), photo_consent_note: note })
    .eq('id', id);
  if (error) return dbFail('recordPhotoConsent', error);
  await audit(auth.user, 'story_photo_consent_recorded', id);
  refresh(id);
  return { ok: true, message: 'اتسجّلت الموافقة.' };
}

// ── النص ─────────────────────────────────────────────────────────────────────

export async function addStudioVersion(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;

  const body = str(formData.get('body'));
  if (!body) return { ok: false, error: 'اكتب نص القصة.', field: 'body' };
  if (body.length > 100000) return { ok: false, error: 'النص طويل جدًا.', field: 'body' };
  const source = str(formData.get('source')) === 'ai' ? 'ai' : 'editor';
  const note = str(formData.get('note'));
  if (note.length > 2000) return { ok: false, error: 'الملاحظة طويلة (الحد ٢٠٠٠ حرف).', field: 'note' };

  const supabase = await createClient();
  const { data: last, error: lastError } = await supabase
    .from('story_versions')
    .select('version_no')
    .eq('project_id', id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return dbFail('addStudioVersion:last', lastError);

  const versionNo = (last?.version_no ?? 0) + 1;
  const { error } = await supabase
    .from('story_versions')
    .insert({ project_id: id, version_no: versionNo, body, source, note: note || null });
  if (error) {
    // ضغطتين متزامنتين على نفس الرقم — رسالة مفهومة بدل خطأ القيد.
    if (error.code === '23505') return { ok: false, error: 'فيه نسخة اتضافت في نفس اللحظة — حدّث الصفحة وجرّب تاني.' };
    return dbFail('addStudioVersion', error);
  }

  // المسودات القديمة غير المعتمدة بتبقى «مستبدلة» عشان النسخة الحالية تبان.
  await supabase
    .from('story_versions')
    .update({ status: 'superseded' })
    .eq('project_id', id)
    .in('status', ['draft', 'changes_requested'])
    .lt('version_no', versionNo);

  await audit(auth.user, 'story_version_added', id, { versionNo, source });
  refresh(id);
  return { ok: true, message: `اتحفظت النسخة ${versionNo}.` };
}

export async function approveStudioVersion(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const versionId = str(formData.get('versionId'));
  const projectId = projectIdOf(formData);
  if (!isUuid(versionId) || !projectId) return { ok: false, error: 'النسخة غير معروفة.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_versions')
    .update({ status: 'editor_approved' })
    .eq('id', versionId)
    .eq('project_id', projectId);
  if (error) return dbFail('approveStudioVersion', error);
  await audit(auth.user, 'story_version_editor_approved', projectId, { versionId });
  refresh(projectId);
  return { ok: true, message: 'اتعتمد النص.' };
}

/**
 * قرار العميل على النص — بيتسجّل بمعرفة الفريق (الموافقة تمت برّه الموقع
 * لحد ما تتبني صفحة «قصتي»)، والملاحظة إلزامية: إزاي ومتى.
 */
export async function recordClientDecision(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const versionId = str(formData.get('versionId'));
  const projectId = projectIdOf(formData);
  if (!isUuid(versionId) || !projectId) return { ok: false, error: 'النسخة غير معروفة.' };
  const decision = str(formData.get('decision'));
  if (decision !== 'approve' && decision !== 'changes') return { ok: false, error: 'اختار القرار.' };
  const note = str(formData.get('note'));
  if (decision === 'approve' && note.length < 5) {
    return { ok: false, error: 'سجّل إزاي ومتى العميل وافق (مثلًا: واتساب بتاريخ كذا).', field: 'note' };
  }
  if (note.length > 1000) return { ok: false, error: 'الملاحظة طويلة (الحد ١٠٠٠ حرف).', field: 'note' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_versions')
    .update({
      status: decision === 'approve' ? 'client_approved' : 'changes_requested',
      client_decision_note: note || null,
    })
    .eq('id', versionId)
    .eq('project_id', projectId);
  if (error) return dbFail('recordClientDecision', error);
  await audit(auth.user, decision === 'approve' ? 'story_client_approved' : 'story_client_requested_changes', projectId, {
    versionId,
  });
  refresh(projectId);
  return { ok: true, message: decision === 'approve' ? 'اتسجّلت موافقة العميل.' : 'اتسجّل طلب التعديل.' };
}

// ── الشخصية ──────────────────────────────────────────────────────────────────

export async function saveStudioCharacter(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;
  const notes = str(formData.get('characterNotes'));
  if (notes.length > 4000) return { ok: false, error: 'الوصف طويل (الحد ٤٠٠٠ حرف).', field: 'characterNotes' };
  const ref = str(formData.get('characterRefUrl'));
  if (ref && !isHttpsUrl(ref)) {
    return { ok: false, error: 'الرابط لازم يبدأ بـ https:// ومن غير مسافات (٥٠٠ حرف كحد أقصى).', field: 'characterRefUrl' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_projects')
    .update({ character_notes: notes || null, character_ref_url: ref || null })
    .eq('id', id);
  if (error) return dbFail('saveStudioCharacter', error);
  await audit(auth.user, 'story_character_saved', id);
  refresh(id);
  return { ok: true, message: 'اتحفظ وصف الشخصية.' };
}

export async function approveStudioCharacter(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from('story_projects')
    .select('character_notes, character_ref_url')
    .eq('id', id)
    .maybeSingle();
  if (readError) return dbFail('approveStudioCharacter:read', readError);
  if (!current?.character_notes && !current?.character_ref_url) {
    return { ok: false, error: 'اكتب وصف الشخصية أو حط رابط المرجع الأول.' };
  }
  const { error } = await supabase
    .from('story_projects')
    .update({ character_approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return dbFail('approveStudioCharacter', error);
  await audit(auth.user, 'story_character_approved', id);
  refresh(id);
  return { ok: true, message: 'اتعتمد مرجع الشخصية.' };
}

// ── الصفحات ──────────────────────────────────────────────────────────────────

export async function saveStudioPage(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;

  const pageNo = Number(str(formData.get('pageNo')));
  if (!Number.isInteger(pageNo) || pageNo < 0 || pageNo > MAX_PAGE_NO) {
    return { ok: false, error: `رقم الصفحة بين ٠ (الغلاف) و${MAX_PAGE_NO}.`, field: 'pageNo' };
  }
  const pageText = str(formData.get('pageText'));
  const scene = str(formData.get('sceneDescription'));
  if (pageText.length > 4000) return { ok: false, error: 'نص الصفحة طويل.', field: 'pageText' };
  if (scene.length > 4000) return { ok: false, error: 'وصف المشهد طويل.', field: 'sceneDescription' };
  const imageUrl = str(formData.get('imageUrl'));
  if (imageUrl && !isHttpsUrl(imageUrl)) {
    return { ok: false, error: 'رابط الصورة لازم يبدأ بـ https:// ومن غير مسافات.', field: 'imageUrl' };
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from('story_pages')
    .select('id, status')
    .eq('project_id', id)
    .eq('page_no', pageNo)
    .maybeSingle();
  if (readError) return dbFail('saveStudioPage:read', readError);

  const ready = pageText.length > 0 && scene.length > 0 && imageUrl.length > 0;
  if (existing) {
    // صفحة محتاجة إعادة وبقت كاملة = «مجهّزة» (القاعدة بتزوّد المحاولات).
    const status = existing.status === 'needs_redo' && ready ? 'drafted' : existing.status === 'pending' && ready ? 'drafted' : existing.status;
    const { error } = await supabase
      .from('story_pages')
      .update({ page_text: pageText, scene_description: scene, image_url: imageUrl || null, status })
      .eq('id', existing.id);
    if (error) return dbFail('saveStudioPage:update', error);
  } else {
    const { error } = await supabase.from('story_pages').insert({
      project_id: id,
      page_no: pageNo,
      page_text: pageText,
      scene_description: scene,
      image_url: imageUrl || null,
      status: ready ? 'drafted' : 'pending',
    });
    if (error) return dbFail('saveStudioPage:insert', error);
  }
  await audit(auth.user, 'story_page_saved', id, { pageNo });
  refresh(id);
  return { ok: true, message: pageNo === 0 ? 'اتحفظ الغلاف.' : `اتحفظت الصفحة ${pageNo}.` };
}

const REVIEWABLE: PageStatus[] = ['approved', 'needs_redo'];

export async function reviewStudioPage(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const pageId = str(formData.get('pageId'));
  const projectId = projectIdOf(formData);
  if (!isUuid(pageId) || !projectId) return { ok: false, error: 'الصفحة غير معروفة.' };
  const decision = str(formData.get('decision')) as PageStatus;
  if (!REVIEWABLE.includes(decision)) return { ok: false, error: 'اختار القرار.' };
  const note = str(formData.get('reviewerNote'));
  if (decision === 'needs_redo' && note.length < 3) {
    return { ok: false, error: 'اكتب سبب الإعادة عشان اللي هيعيدها يعرف يعمل إيه.', field: 'reviewerNote' };
  }
  if (note.length > 1000) return { ok: false, error: 'الملاحظة طويلة (الحد ١٠٠٠ حرف).', field: 'reviewerNote' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_pages')
    .update({ status: decision, reviewer_note: note || null })
    .eq('id', pageId)
    .eq('project_id', projectId);
  if (error) return dbFail('reviewStudioPage', error);
  await audit(auth.user, 'story_page_reviewed', projectId, { pageId, decision });
  refresh(projectId);
  return { ok: true, message: `الصفحة: ${PAGE_STATUS_LABELS[decision]}.` };
}

export async function deleteStudioPage(formData: FormData): Promise<StudioActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const pageId = str(formData.get('pageId'));
  const projectId = projectIdOf(formData);
  if (!isUuid(pageId) || !projectId) return { ok: false, error: 'الصفحة غير معروفة.' };
  const supabase = await createClient();
  const { error } = await supabase.from('story_pages').delete().eq('id', pageId).eq('project_id', projectId);
  if (error) return dbFail('deleteStudioPage', error);
  await audit(auth.user, 'story_page_deleted', projectId, { pageId });
  refresh(projectId);
  return { ok: true, message: 'اتحذفت الصفحة.' };
}

// ── فحص الجودة ───────────────────────────────────────────────────────────────

export async function saveStudioQa(formData: FormData): Promise<StudioActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;
  const checklist: Record<string, boolean> = {};
  for (const item of [...QA_ITEMS, QA_SENSITIVE_ITEM]) {
    checklist[item.key] = formData.get(item.key) === 'on';
  }
  const supabase = await createClient();
  const { error } = await supabase.from('story_projects').update({ qa_checklist: checklist }).eq('id', id);
  if (error) return dbFail('saveStudioQa', error);
  await audit(auth.user, 'story_qa_saved', id, { checked: Object.values(checklist).filter(Boolean).length });
  refresh(id);
  return { ok: true, message: 'اتحفظت قايمة الفحص.' };
}

// ── تحريك المشروع ────────────────────────────────────────────────────────────

export async function moveStudioProject(formData: FormData): Promise<StudioActionResult> {
  const auth = await worker();
  if (!auth.ok) return auth;
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;
  const to = str(formData.get('to'));
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(to)) return { ok: false, error: 'الحالة غير معروفة.' };
  const note = str(formData.get('note'));
  if (note.length > 1000) return { ok: false, error: 'الملاحظة طويلة (الحد ١٠٠٠ حرف).', field: 'note' };

  const patch: { status: string; delivery_note?: string | null } = { status: to };
  if (to === 'delivered') patch.delivery_note = note || null;

  const supabase = await createClient();
  const { data: before } = await supabase.from('story_projects').select('status').eq('id', id).maybeSingle();
  const { data: moved, error } = await supabase.from('story_projects').update(patch).eq('id', id).select('status');
  if (error) return dbFail('moveStudioProject', error);
  if (!moved || moved.length === 0) return { ok: false, error: NOT_ALLOWED };
  await audit(auth.user, 'story_project_moved', id, { from: before?.status ?? null, to, note: note || undefined });
  refresh(id);
  revalidatePath('/dashboard/admin/orders');
  return { ok: true, message: 'اتحرّك المشروع.' };
}

// ── التكلفة ──────────────────────────────────────────────────────────────────

export async function addStudioCost(formData: FormData): Promise<StudioActionResult> {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageStudio') && !hasAdminPermission(user, 'canManageFinance')) {
    return { ok: false, error: NOT_ALLOWED };
  }
  const id = projectIdOf(formData);
  if (!id) return BAD_PROJECT;
  const kind = str(formData.get('kind')) as CostKind;
  if (!COST_KINDS.includes(kind)) return { ok: false, error: 'اختار نوع التكلفة.', field: 'kind' };
  const amount = Number(str(formData.get('amount')) || '0');
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    return { ok: false, error: 'المبلغ بين ٠ ومليون.', field: 'amount' };
  }
  const minutesRaw = str(formData.get('minutes'));
  let minutes: number | null = null;
  if (minutesRaw) {
    const m = Number(minutesRaw);
    if (!Number.isInteger(m) || m < 0 || m > 100000) {
      return { ok: false, error: 'الدقائق رقم صحيح موجب.', field: 'minutes' };
    }
    minutes = m;
  }
  const note = str(formData.get('note'));
  if (note.length > 500) return { ok: false, error: 'الملاحظة طويلة (الحد ٥٠٠ حرف).', field: 'note' };
  if (amount === 0 && minutes === null) return { ok: false, error: 'اكتب مبلغًا أو دقائق.', field: 'amount' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('story_cost_entries')
    .insert({ project_id: id, kind, amount, minutes, note: note || null, created_by: user.id });
  if (error) return dbFail('addStudioCost', error);
  await audit(user, 'story_cost_added', id, { kind, amount, minutes });
  refresh(id);
  return { ok: true, message: 'اتسجّلت التكلفة.' };
}

/**
 * ابعت نسخة النص لولي الأمر يعاينها — غلاف `FormData` لشاشة الاستوديو.
 *
 * ⚠️ **المنطق مش هنا.** `sendStoryVersionToClient` في
 *    `@/actions/story-preview` هو اللي بينادي القاعدة ويبعت
 *    الإشعار ويكتب التدقيق — ودي بتترجم `FormData` بس وبتفرّغ
 *    كاش شاشة المشروع. نسختين من المنطق كانت هتخلّي الإشعار
 *    يتبعت من مكان ومايتبعتش من التاني.
 */
export async function sendVersionToClient(formData: FormData): Promise<StudioActionResult> {
  const versionId = str(formData.get('versionId'));
  const projectId = projectIdOf(formData);
  if (!isUuid(versionId) || !projectId) return { ok: false, error: 'النسخة غير معروفة.' };

  const { sendStoryVersionToClient } = await import('@/actions/story-preview');
  const result = await sendStoryVersionToClient(versionId);
  if (!result.ok) return { ok: false, error: result.error };

  refresh(projectId);
  return { ok: true, message: 'اتبعتت لولي الأمر.' };
}
