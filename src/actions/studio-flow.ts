'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { studioErrorMessage } from '@/lib/studio';
import { isAbility, isGateKey, type StageOwnerKind } from '@/lib/studio-flow';

/**
 * إدارة هيكل سير عمل الاستوديو من الشاشة: إضافة مرحلة · حذف · ترتيب · قدرات وشروط
 * ومين ينقل · الانتقالات الاستثنائية.
 *
 * ⚠️ **الحارس الحقيقي دوال القاعدة** (`studio_stage_*` و`studio_edges_set`، ملف
 * `20261016040000_workflow_engine_unified_distribution.sql`): بتتحقق من الصلاحية
 * (مسؤول إنتاج القصص) ومن سلامة التدفق، ومابتسمحش بحذف/تعطيل مرحلة فيها مشاريع.
 * اللي هنا رسالة عربي وتحقّق من المدخلات وسجل التدقيق.
 *
 * بترجّع `{ ok, … }` ومابترميش.
 */

export type StudioFlowResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

const NOT_ALLOWED = 'هيكل الاستوديو لمسؤول إنتاج القصص.';
const OWNERS: readonly string[] = ['editor', 'art_lead', 'manager'];
const KEY = /^[a-z][a-z0-9_]{1,40}$/;

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');

async function flowAdmin() {
  try {
    return { ok: true as const, user: await requireAdmin('canManageStudio', NOT_ALLOWED) };
  } catch {
    return { ok: false as const, error: NOT_ALLOWED };
  }
}

function refresh() {
  revalidatePath('/dashboard/admin/studio');
  revalidatePath('/dashboard/admin/studio/settings');
  revalidatePath('/dashboard/admin/tasks');
  revalidatePath('/dashboard/admin/tasks/workflow');
}

function fail(context: string, error: { code?: string | null; message?: string | null }): StudioFlowResult {
  console.error(`studio-flow:${context}`, error);
  return { ok: false, error: studioErrorMessage(error) };
}

export async function createStudioStage(formData: FormData): Promise<StudioFlowResult> {
  const auth = await flowAdmin();
  if (!auth.ok) return auth;
  const label = str(formData.get('label'));
  if (label.length < 2 || label.length > 60) return { ok: false, error: 'اسم المرحلة من ٢ لـ٦٠ حرف.', field: 'label' };
  const after = str(formData.get('after'));
  if (!KEY.test(after)) return { ok: false, error: 'اختار المرحلة اللي هتتحط بعدها.', field: 'after' };
  const owner = str(formData.get('ownerKind'));
  if (!OWNERS.includes(owner)) return { ok: false, error: 'اختار صاحب المرحلة.', field: 'ownerKind' };
  const hint = str(formData.get('hint'));
  if (hint.length > 300) return { ok: false, error: 'الشرح أطول من ٣٠٠ حرف.', field: 'hint' };
  const slaRaw = str(formData.get('slaHours')).replace(',', '.');
  let sla: number | null = null;
  if (slaRaw !== '') {
    sla = Number(slaRaw);
    if (!Number.isFinite(sla) || sla < 0.25 || sla > 2160) {
      return { ok: false, error: 'المهلة من ربع ساعة لـ٢١٦٠ ساعة — أو سيبها فاضية.', field: 'slaHours' };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('studio_stage_create', {
    p_label: label,
    p_after: after,
    p_hint: hint || undefined,
    p_sla: sla ?? undefined,
    p_owner: owner as StageOwnerKind,
  });
  if (error) return fail('create', error);
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'studio_stage_created',
    entityType: 'task_step',
    entityId: `studio:${data}`,
    metadata: { label, after, owner },
  });
  refresh();
  return { ok: true, message: 'اتضافت المرحلة. اضبط شروطها وقدراتها ومسؤوليها من بطاقتها.' };
}

export async function moveStudioStage(step: string, dir: number): Promise<StudioFlowResult> {
  const auth = await flowAdmin();
  if (!auth.ok) return auth;
  if (!KEY.test(step) || (dir !== -1 && dir !== 1)) return { ok: false, error: 'طلب غير صحيح.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_stage_move', { p_step: step, p_dir: dir });
  if (error) return fail('move', error);
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'studio_stage_moved',
    entityType: 'task_step',
    entityId: `studio:${step}`,
    metadata: { dir },
  });
  refresh();
  return { ok: true };
}

export async function deleteStudioStage(step: string): Promise<StudioFlowResult> {
  const auth = await flowAdmin();
  if (!auth.ok) return auth;
  if (!KEY.test(step)) return { ok: false, error: 'طلب غير صحيح.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_stage_delete', { p_step: step });
  if (error) return fail('delete', error);
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'studio_stage_deleted',
    entityType: 'task_step',
    entityId: `studio:${step}`,
  });
  refresh();
  return { ok: true, message: 'اتحذفت المرحلة.' };
}

/** قدرات المرحلة وشروط دخولها ومين ينقل منها وهل هي فعّالة. */
export async function saveStudioStageFlow(formData: FormData): Promise<StudioFlowResult> {
  const auth = await flowAdmin();
  if (!auth.ok) return auth;
  const step = str(formData.get('step'));
  if (!KEY.test(step)) return { ok: false, error: 'المرحلة غير معروفة.' };
  const abilities = formData.getAll('abilities').map(String).filter(isAbility);
  const gates = formData.getAll('gates').map(String).filter(isGateKey);
  const advanceBy = str(formData.get('advanceBy'));
  if (advanceBy !== 'owner' && advanceBy !== 'manager') return { ok: false, error: 'اختار مين ينقل من المرحلة.', field: 'advanceBy' };
  const active = formData.get('active') === 'on';

  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_stage_flow', {
    p_step: step,
    p_active: active,
    p_abilities: abilities,
    p_gates: gates,
    p_advance_by: advanceBy,
  });
  if (error) return fail('flow', error);
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'studio_stage_flow_saved',
    entityType: 'task_step',
    entityId: `studio:${step}`,
    metadata: { active, abilities, gates, advanceBy },
  });
  refresh();
  return { ok: true, message: 'اتحفظ سلوك المرحلة.' };
}

/** الانتقالات الاستثنائية الخارجة من مرحلة (رجوع/قفز) — بتستبدل القايمة كلها. */
export async function saveStudioEdges(formData: FormData): Promise<StudioFlowResult> {
  const auth = await flowAdmin();
  if (!auth.ok) return auth;
  const from = str(formData.get('from'));
  if (!KEY.test(from)) return { ok: false, error: 'المرحلة غير معروفة.' };
  const targets = Array.from(new Set(formData.getAll('edge').map(String))).filter((t) => KEY.test(t));
  const edges = targets.map((to) => ({
    to,
    who: str(formData.get(`who:${to}`)) === 'manager' ? 'manager' : 'owner',
    skipGates: formData.get(`skipGates:${to}`) === 'on',
    pagesRedo: formData.get(`pagesRedo:${to}`) === 'on',
    resetQa: formData.get(`resetQa:${to}`) === 'on',
  }));

  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_edges_set', { p_from: from, p_edges: edges });
  if (error) return fail('edges', error);
  await logAuditAction({
    actorProfileId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'studio_edges_saved',
    entityType: 'task_step',
    entityId: `studio:${from}`,
    metadata: { edges },
  });
  refresh();
  return { ok: true, message: 'اتحفظت الانتقالات.' };
}
