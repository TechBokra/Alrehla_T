'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireAnyAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';
import {
  isStageOfLine,
  isTaskStepOwner,
  isWorkLine,
  isWorkPriority,
  isWorkStage,
} from '@/lib/work-tasks';
import type { AdminPermission } from '@/types';

/**
 * توزيع الطلبات على المسؤولين (ملف 14).
 *
 * المهام نفسها **بتتعمل وتتقفل لوحدها في القاعدة** مع حالة الطلب. هنا:
 * الإعدادات (مين مسؤول عن إيه)، و«تم» بالإيد، وتغيير المسؤول.
 *
 * كل الدوال بترجّع ولا بترمي (قاعدة «هـ»).
 */

/**
 * `warning` = العملية نجحت وفيه حاجة جنبها وقعت (الإشعار مثلًا) — نجاح
 * بتحذير، مش فشل: الشاشة بتحدّث نفسها **و**بتعرض السطر.
 */
export type WorkTaskResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string; field?: string };

const ALL: AdminPermission[] = [
  'canManageUsers', 'canManageInstructors', 'canManagePublishers', 'canManageCatalog',
  'canManageSubscriptions', 'canManageOrders', 'canManageBookings', 'canManageSupport',
  'canManageContent', 'canManageFinance', 'canAssignWork', 'canViewAuditLogs',
  'canManageStudio', 'canWorkStudio',
];

async function anyAdmin() {
  try {
    return await requireAnyAdmin(ALL, 'المهام للإدارة بس');
  } catch {
    return null;
  }
}

/** الإداريين فعلًا — عشان مايتسندش لحد مش إداري (القاعدة بتتجاهله برضه). */
async function onlyAdmins(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x)));
  if (unique.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('id')
    .in('id', unique)
    .in('role', ['super_admin', 'general_supervisor']);
  return (data ?? []).map((r) => r.id);
}

/** مين مسؤول عن نوع ومرحلة — بيستبدل القايمة كلها. */
export async function saveAssignmentRule(
  line: string,
  stage: string,
  profileIds: string[],
): Promise<WorkTaskResult> {
  let admin;
  try {
    admin = await requireAdmin('canAssignWork', 'توزيع الطلبات محتاج صلاحية «توزيع المهام والطلبات»');
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح' };
  }
  if (!isWorkLine(line) || !isWorkStage(stage) || !isStageOfLine(line, stage)) {
    return { ok: false, error: 'نوع أو مرحلة غير معروفة' };
  }

  const ids = await onlyAdmins(profileIds);
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('assignment_rules')
    .delete()
    .eq('line', line)
    .eq('stage', stage);
  if (delError) {
    if (delError.code === '42P01') return { ok: false, error: 'التوزيع محتاج ملف القاعدة 14 يتشغّل الأول' };
    console.error('saveAssignmentRule delete', delError);
    return { ok: false, error: 'تعذّر حفظ التوزيع' };
  }
  if (ids.length) {
    const { error } = await supabase
      .from('assignment_rules')
      .insert(ids.map((profile_id) => ({ line, stage, profile_id })));
    if (error) {
      console.error('saveAssignmentRule insert', error);
      return { ok: false, error: 'تعذّر حفظ التوزيع — القايمة اتفضّت، جرّب تاني' };
    }
  }

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'assignment_rule_saved',
    entityType: 'assignment_rule',
    entityId: `${line}:${stage}`,
    metadata: { profileIds: ids },
  });
  revalidatePath('/dashboard/admin/tasks/assignments');
  return { ok: true };
}

/** «تم» بالإيد — لما المهمة خلصت من غير ما حالة الطلب تتغيّر (الصندوق مثلًا). */
export async function completeWorkTask(id: string): Promise<WorkTaskResult> {
  const admin = await anyAdmin();
  if (!admin) return { ok: false, error: 'المهام للإدارة بس' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_tasks')
    .update({ status: 'done', done_at: new Date().toISOString(), done_by: admin.id })
    .eq('id', id)
    .eq('status', 'open')
    .select('id');
  if (error) {
    console.error('completeWorkTask', error);
    return { ok: false, error: 'تعذّر قفل المهمة' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'المهمة اتقفلت قبل كده — حدّث الصفحة' };
  revalidatePath('/dashboard/admin/tasks');
  return { ok: true };
}

/** تغيير المسؤول عن مهمة — والجديد بيوصله إشعار. */
export async function reassignWorkTask(id: string, profileIds: string[]): Promise<WorkTaskResult> {
  // ⚠️ **مش أي إداري** (قرار تامر، ١٥ أكتوبر): كان أي حد في الإدارة يقدر
  //    يغيّر مسؤول أي مهمة — يعني مسؤول المحتوى يسحب مراجعة دفع من
  //    المحاسب ويسنّدها لنفسه. تغيير المسؤول قرار تشغيلي وليه صلاحيته.
  //    و«تم» فاضلة لأي إداري: اللي المهمة عنده بيقفلها.
  let admin;
  try {
    admin = await requireAdmin(
      'canAssignWork',
      'تغيير مسؤول المهمة محتاج صلاحية «توزيع المهام والطلبات»',
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح' };
  }
  const ids = await onlyAdmins(profileIds);
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('work_tasks')
    .select('assignee_ids, title, link, reference')
    .eq('id', id)
    .maybeSingle();
  if (!before) return { ok: false, error: 'المهمة مش موجودة' };

  const { data, error } = await supabase
    .from('work_tasks')
    .update({ assignee_ids: ids })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    console.error('reassignWorkTask', error);
    return { ok: false, error: 'تعذّر تغيير المسؤول' };
  }

  // إشعار للي اتضاف بس (مش للي كان مسؤول أصلًا).
  const added = ids.filter((x) => !(before.assignee_ids ?? []).includes(x) && x !== admin.id);
  let failedNotices = 0;
  for (const who of added) {
    // ⚠️ `notifyUser` (عن طريق `notify_user` في القاعدة) — الإداري ماعندوش
    //    صلاحية كتابة مباشرة في جدول الإشعارات.
    const notice = await notifyUser({
      recipientProfileId: who,
      title: before.title,
      message: `${admin.fullName || 'الإدارة'} سند ليك المهمة دي${before.reference ? ` — ${before.reference}` : ''}. تلاقيها في «مهامي».`,
      link: before.link,
    });
    if (notice.reason === 'failed') failedNotices += 1;
  }

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'work_task_reassigned',
    entityType: 'work_task',
    entityId: id,
    metadata: { profileIds: ids },
  });
  revalidatePath('/dashboard/admin/tasks');

  // ⚠️ **التسنيد اتحفظ، والإشعار هو اللي وقع.** الشاشة بتقول للإداري
  //    «المسؤول الجديد بيوصله إشعار» — فلازم يعرف لما ده مايحصلش،
  //    عشان يبلّغه بنفسه، بدل ما يستنى حد شايف حاجة ماوصلتهوش.
  if (failedNotices > 0) {
    return {
      ok: true,
      warning: 'المهمة اتسندت، بس الإشعار ماوصلش — بلّغ المسؤول بنفسك.',
    };
  }
  return { ok: true };
}


// ── المواعيد والأولوية والملاحظات ──────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assigner() {
  try {
    return await requireAdmin('canAssignWork', 'ده محتاج صلاحية «توزيع المهام والطلبات»');
  } catch (e) {
    return e instanceof Error ? e.message : 'غير مصرح';
  }
}

/**
 * تغيير موعد مهمة مفتوحة، أو شيله (`null`). الموعد لازم يبقى في المستقبل — موعد
 * فات معناه «متأخرة» من اللحظة دي، وده مش تعديل، ده إنذار مزيّف.
 *
 * ⚠️ الحارس الحقيقي في القاعدة (`work_tasks_guard_fn`): غير حامل «توزيع المهام»
 *    مايقدرش يغيّر الموعد حتى لو كلّم القاعدة مباشرة.
 */
export async function setWorkTaskDue(id: string, dueAtIso: string | null): Promise<WorkTaskResult> {
  const admin = await assigner();
  if (typeof admin === 'string') return { ok: false, error: admin };
  if (!UUID_RE.test(id)) return { ok: false, error: 'المهمة مش موجودة' };

  let due: string | null = null;
  if (dueAtIso !== null) {
    const d = new Date(dueAtIso);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'الموعد مش مظبوط', field: 'dueAt' };
    const now = Date.now();
    if (d.getTime() < now - 60_000) return { ok: false, error: 'الموعد لازم يبقى في المستقبل', field: 'dueAt' };
    if (d.getTime() > now + 366 * 86_400_000) return { ok: false, error: 'الموعد بعيد أوي — اختار خلال سنة', field: 'dueAt' };
    due = d.toISOString();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_tasks')
    .update({ due_at: due })
    .eq('id', id)
    .eq('status', 'open')
    .select('id');
  if (error) {
    console.error('setWorkTaskDue', error);
    return { ok: false, error: error.code === '42501' ? 'مالكش صلاحية تغيّر الموعد' : 'تعذّر تغيير الموعد' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'المهمة اتقفلت أو مش موجودة — حدّث الصفحة' };

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'work_task_due_changed',
    entityType: 'work_task',
    entityId: id,
    metadata: { dueAt: due },
  });
  revalidatePath('/dashboard/admin/tasks');
  revalidatePath(`/dashboard/admin/tasks/${id}`);
  return { ok: true };
}

export async function setWorkTaskPriority(id: string, priority: string): Promise<WorkTaskResult> {
  const admin = await assigner();
  if (typeof admin === 'string') return { ok: false, error: admin };
  if (!UUID_RE.test(id)) return { ok: false, error: 'المهمة مش موجودة' };
  if (!isWorkPriority(priority)) return { ok: false, error: 'أولوية غير معروفة' };

  const supabase = await createClient();
  const { data, error } = await supabase.from('work_tasks').update({ priority }).eq('id', id).select('id');
  if (error) {
    console.error('setWorkTaskPriority', error);
    return { ok: false, error: error.code === '42501' ? 'مالكش صلاحية تغيّر الأولوية' : 'تعذّر تغيير الأولوية' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'المهمة مش موجودة' };

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'work_task_priority_changed',
    entityType: 'work_task',
    entityId: id,
    metadata: { priority },
  });
  revalidatePath('/dashboard/admin/tasks');
  revalidatePath(`/dashboard/admin/tasks/${id}`);
  return { ok: true };
}

/** ملاحظة على المهمة — أي إداري، وبتظهر في سجلها باسمه (القاعدة بتفرض إن الاسم اسمه). */
export async function addWorkTaskNote(id: string, note: string): Promise<WorkTaskResult> {
  const admin = await anyAdmin();
  if (!admin) return { ok: false, error: 'المهام للإدارة بس' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'المهمة مش موجودة' };
  const text = (note ?? '').trim();
  if (text.length === 0) return { ok: false, error: 'اكتب الملاحظة الأول', field: 'note' };
  if (text.length > 1000) return { ok: false, error: 'الملاحظة طويلة — الحد ١٠٠٠ حرف', field: 'note' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('work_task_events')
    .insert({ task_id: id, kind: 'note', actor_id: admin.id, note: text });
  if (error) {
    console.error('addWorkTaskNote', error);
    return { ok: false, error: 'تعذّر حفظ الملاحظة' };
  }
  revalidatePath(`/dashboard/admin/tasks/${id}`);
  return { ok: true };
}

// ── كتالوج المراحل (الاسم · الشرح · المهلة · الصاحب · التبويب) ──────────────────

const num = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');

/**
 * حفظ مرحلة واحدة. بتتنادى من «المراحل والمواعيد» (كل الأنواع) ومن «إعدادات
 * الاستوديو» (مراحل الاستوديو).
 *
 * المهلة = ساعات من دخول المهمة المرحلة؛ بتتطبّق على المهام **اللي بتدخل المرحلة بعد
 * كده** (المفتوحة حاليًا بتفضل بموعدها — عدّلها من تفاصيل المهمة لو لزم). اسم المرحلة
 * وصاحبها في الاستوديو بيتحدّثوا على المشاريع الشغّالة فورًا.
 */
export async function saveTaskStep(formData: FormData): Promise<WorkTaskResult> {
  const line = num(formData.get('line'));
  const step = num(formData.get('step'));
  if (!isWorkLine(line) || !step) return { ok: false, error: 'المرحلة غير معروفة' };

  let admin;
  try {
    admin =
      line === 'studio'
        ? await requireAnyAdmin(['canAssignWork', 'canManageStudio'], 'مراحل الاستوديو لمسؤول الإنتاج')
        : await requireAdmin('canAssignWork', 'المراحل والمواعيد محتاجة صلاحية «توزيع المهام والطلبات»');
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح' };
  }

  const label = num(formData.get('label'));
  if (label.length < 2 || label.length > 60) return { ok: false, error: 'اسم المرحلة من ٢ لـ٦٠ حرف', field: 'label' };
  const hint = num(formData.get('hint'));
  if (hint.length > 300) return { ok: false, error: 'الشرح أطول من ٣٠٠ حرف', field: 'hint' };

  const slaRaw = num(formData.get('slaHours')).replace(',', '.');
  let sla: number | null = null;
  if (slaRaw !== '') {
    sla = Number(slaRaw);
    if (!Number.isFinite(sla) || sla < 0.25 || sla > 2160) {
      return { ok: false, error: 'المهلة من ربع ساعة لـ٢١٦٠ ساعة (٩٠ يوم) — أو سيبها فاضية لو من غير موعد', field: 'slaHours' };
    }
    sla = Math.round(sla * 100) / 100;
  }

  let ownerKind = 'rule';
  if (line === 'studio') {
    ownerKind = num(formData.get('ownerKind'));
    if (!isTaskStepOwner(ownerKind) || ownerKind === 'rule') {
      return { ok: false, error: 'اختار صاحب المرحلة', field: 'ownerKind' };
    }
  }
  const showTab = formData.get('showTab') === 'on' || formData.get('showTab') === 'true';

  const supabase = await createClient();
  const patch: {
    label: string; hint: string | null; sla_hours: number | null; owner_kind: string; show_tab?: boolean;
  } = { label, hint: hint || null, sla_hours: sla, owner_kind: ownerKind };
  // التبويب بيتعدّل في الاستوديو بس (فورم النوع التاني مالوش الخانة دي).
  if (line === 'studio') patch.show_tab = showTab;

  const { data, error } = await supabase
    .from('task_steps')
    .update(patch)
    .eq('line', line)
    .eq('step', step)
    .select('step');
  if (error) {
    console.error('saveTaskStep', error);
    return { ok: false, error: error.code === '42501' ? 'مالكش صلاحية تعدّل المرحلة دي' : 'تعذّر حفظ المرحلة' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'المرحلة مش موجودة أو مالكش صلاحية عليها' };

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'task_step_saved',
    entityType: 'task_step',
    entityId: `${line}:${step}`,
    metadata: { label, slaHours: sla, ownerKind, ...(line === 'studio' ? { showTab } : {}) },
  });
  revalidatePath('/dashboard/admin/tasks');
  revalidatePath('/dashboard/admin/tasks/steps');
  if (line === 'studio') {
    revalidatePath('/dashboard/admin/studio');
    revalidatePath('/dashboard/admin/studio/settings');
  }
  return { ok: true };
}
