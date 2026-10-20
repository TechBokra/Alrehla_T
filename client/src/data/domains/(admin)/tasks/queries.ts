import {
  type TaskStep,
  type WorkLine,
  type WorkPriority,
  type WorkStage,
  type WorkTaskEvent,
  isTaskStepOwner,
  isWorkLine,
  isWorkPriority,
  isWorkStage,
  isWorkTaskEventKind,
} from '@/lib/work-tasks';
import { createClient } from '@/lib/supabase/server';
import { clampLeadDays } from '@/lib/box-schedule';

export type AdminPerson = {
  id: string;
  name: string;
  /** دوره الإداري («محاسب»، «مسؤول محتوى»…) — للتفريق بين اسمين متشابهين. */
  roleName?: string;
};

export type WorkTask = {
  id: string;
  line: WorkLine;
  stage: WorkStage;
  sourceId: string;
  reference: string | null;
  title: string;
  link: string;
  assigneeIds: string[];
  status: 'open' | 'done';
  createdAt: string;
  doneAt: string | null;
  /** المرحلة الدقيقة (حالة الطلب / مرحلة المشروع) — أو نفس المرحلة العامة. */
  step: string;
  /** من إمتى المهمة في مرحلتها الحالية. */
  stepChangedAt: string;
  /** الموعد — `null` = من غير موعد. */
  dueAt: string | null;
  priority: WorkPriority;
};

type TaskRow = {
  id: string;
  line: string;
  stage: string;
  source_id: string;
  reference: string | null;
  title: string;
  link: string;
  assignee_ids: string[] | null;
  status: string;
  created_at: string;
  done_at: string | null;
  // أعمدة migration 20261016030000 — ممكن تكون ناقصة لو الـ migration لسه ماتطبّقتش.
  step?: string | null;
  step_changed_at?: string | null;
  due_at?: string | null;
  priority?: string | null;
};

function toTask(t: TaskRow): WorkTask | null {
  if (!isWorkLine(t.line) || !isWorkStage(t.stage)) return null;
  return {
    id: t.id,
    line: t.line,
    stage: t.stage,
    sourceId: t.source_id,
    reference: t.reference,
    title: t.title,
    link: t.link,
    assigneeIds: t.assignee_ids ?? [],
    status: t.status === 'done' ? 'done' : 'open',
    createdAt: t.created_at,
    doneAt: t.done_at,
    step: t.step || t.stage,
    stepChangedAt: t.step_changed_at || t.created_at,
    dueAt: t.due_at ?? null,
    priority: isWorkPriority(t.priority) ? t.priority : 'normal',
  };
}

/**
 * الإداريين — اللي ينفع يتسند لهم.
 *
 * ⚠️ **الدور الإداري بييجي معاهم عن قصد.** الشاشة بقت بحث بالاسم بدل
 *    قايمة قصيرة، والفريق لما يكبر بيبقى فيه أكتر من «أحمد» — فالاسم
 *    لوحده مابيكفيش للتسنيد الصح.
 *
 * ⚠️ **والمؤرشف والموقوف مابيظهروش.** كانوا بيظهروا في القايمة، فمهمة
 *    ممكن تتسند لحساب مقفول وتفضل مستنية مسؤول مش بيدخل.
 */
export async function getAdminPeople(): Promise<AdminPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, admin_role_id')
    .in('role', ['super_admin', 'general_supervisor'])
    .is('archived_at', null)
    .is('suspended_at', null)
    .order('full_name');

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // أسماء الأدوار في استعلام واحد — وفشلها مش بيمنع القايمة من الظهور.
  const roleIds = [
    ...new Set(
      rows
        .map((p) => (p as { admin_role_id?: string | null }).admin_role_id)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const roleNameById = new Map<string, string>();
  if (roleIds.length > 0) {
    const { data: roles, error } = await supabase
      .from('admin_roles')
      .select('id, name')
      .in('id', roleIds);
    if (error) console.error('getAdminPeople: admin_roles read failed', error);
    for (const r of roles ?? []) roleNameById.set(r.id, r.name);
  }

  return rows.map((p) => {
    const roleId = (p as { admin_role_id?: string | null }).admin_role_id;
    return {
      id: p.id,
      name: p.full_name,
      // عمود فاضي = الدور الافتراضي، زيّ ما في `auth/queries`.
      roleName: (roleId ? roleNameById.get(roleId) : undefined) ?? 'مشرف عام',
    };
  });
}

/** `null` = ملف 14 لسه ماتشغّلش. */
export async function getAssignmentRules(): Promise<Record<string, string[]> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('assignment_rules').select('line, stage, profile_id');
  if (error) {
    if (error.code !== '42P01') console.error('getAssignmentRules', error);
    return null;
  }
  const out: Record<string, string[]> = {};
  for (const r of data ?? []) (out[`${r.line}:${r.stage}`] ??= []).push(r.profile_id);
  return out;
}

/**
 * المهام — المفتوحة كلها + اللي اتقفلت آخر ١٤ يوم. `null` = ملف 14 لسه ماتشغّلش.
 * (قواعد الحماية بتقصر القراءة على الإدارة.)
 */
export async function getWorkTasks(): Promise<WorkTask[] | null> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('work_tasks')
    .select('*')
    .or(`status.eq.open,done_at.gte.${since}`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (error.code !== '42P01') console.error('getWorkTasks', error);
    return null;
  }
  return ((data ?? []) as TaskRow[]).map(toTask).filter((t): t is WorkTask => t !== null);
}

/** مهمة واحدة (صفحة التفاصيل). */
export async function getWorkTask(id: string): Promise<WorkTask | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('work_tasks').select('*').eq('id', id).maybeSingle();
  if (error) {
    if (error.code !== '42P01') console.error('getWorkTask', error);
    return null;
  }
  return data ? toTask(data as TaskRow) : null;
}

/** باقي مهام نفس الطلب/المشروع (مراجعة الدفع ← التنفيذ…) — مسار الشغل كله. */
export async function getSiblingTasks(line: WorkLine, sourceId: string): Promise<WorkTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_tasks')
    .select('*')
    .eq('line', line)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('getSiblingTasks', error);
    return [];
  }
  return ((data ?? []) as TaskRow[]).map(toTask).filter((t): t is WorkTask => t !== null);
}

type EventRow = {
  id: number;
  task_id: string;
  kind: string;
  actor_id: string | null;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
};

function toEvent(e: EventRow): WorkTaskEvent | null {
  if (!isWorkTaskEventKind(e.kind)) return null;
  return {
    id: e.id,
    taskId: e.task_id,
    kind: e.kind,
    actorId: e.actor_id,
    fromValue: e.from_value,
    toValue: e.to_value,
    note: e.note,
    createdAt: e.created_at,
  };
}

/** سجل مهام بعينها (الأقدم أولًا). `null` = الجدول لسه ماتعملش. */
export async function getTaskEvents(taskIds: string[]): Promise<WorkTaskEvent[] | null> {
  if (taskIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_task_events')
    .select('*')
    .in('task_id', taskIds)
    .order('id', { ascending: true })
    .limit(500);
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('getTaskEvents', error);
    return null;
  }
  return ((data ?? []) as EventRow[]).map(toEvent).filter((e): e is WorkTaskEvent => e !== null);
}

export type RecentTaskEvent = WorkTaskEvent & { taskTitle: string; taskLink: string; taskLine: WorkLine; taskStage: WorkStage };

/** آخر التطورات على كل المهام (للمدير). التذكيرات الآلية مش بتتعرض هنا. */
export async function getRecentTaskEvents(limit = 25): Promise<RecentTaskEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_task_events')
    .select('*')
    .not('kind', 'in', '(reminder_soon,reminder_overdue)')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('getRecentTaskEvents', error);
    return [];
  }
  const events = ((data ?? []) as EventRow[]).map(toEvent).filter((e): e is WorkTaskEvent => e !== null);
  const ids = [...new Set(events.map((e) => e.taskId))];
  if (ids.length === 0) return [];
  const { data: tasks } = await supabase.from('work_tasks').select('id, title, link, line, stage').in('id', ids);
  const byId = new Map((tasks ?? []).map((t) => [t.id, t]));
  const out: RecentTaskEvent[] = [];
  for (const e of events) {
    const t = byId.get(e.taskId);
    if (!t || !isWorkLine(t.line) || !isWorkStage(t.stage)) continue;
    out.push({ ...e, taskTitle: t.title, taskLink: `/dashboard/admin/tasks/${t.id}`, taskLine: t.line, taskStage: t.stage });
  }
  return out;
}

/** كتالوج المراحل (الاسم والمهلة والصاحب). `null` = الجدول لسه ماتعملش. */
export async function getTaskSteps(line?: WorkLine): Promise<TaskStep[] | null> {
  const supabase = await createClient();
  let q = supabase.from('task_steps').select('*').order('sort_order', { ascending: true });
  if (line) q = q.eq('line', line);
  const { data, error } = await q;
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('getTaskSteps', error);
    return null;
  }
  return (data ?? [])
    .filter((r) => isWorkLine(r.line))
    .map((r) => ({
      line: r.line as WorkLine,
      step: r.step,
      label: r.label,
      hint: r.hint,
      slaHours: r.sla_hours === null ? null : Number(r.sla_hours),
      ownerKind: isTaskStepOwner(r.owner_kind) ? r.owner_kind : 'rule',
      sortOrder: r.sort_order,
      showTab: r.show_tab,
    }));
}

/**
 * فحص المواعيد (إشعارات «قرب» و«فات»). بيتنادى لما إداري يفتح صفحة المهام —
 * مقيّد في القاعدة بمرة كل ١٠ دقايق، وفشله مابيأثرش على الصفحة.
 */
export async function runTaskDeadlineSweep(): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('work_tasks_sweep_if_due');
    if (error && error.code !== 'PGRST202' && error.code !== '42883') {
      console.error('runTaskDeadlineSweep', error.message);
    }
  } catch (e) {
    console.error('runTaskDeadlineSweep', e);
  }
}

/** كام يوم قبل موعد شحنة الصندوق تتفتح مهمتها (الافتراضي ٧). */
export async function getBoxShipmentLeadDays(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'general').maybeSingle();
  const v = (data?.value ?? {}) as { boxShipmentLeadDays?: unknown };
  return clampLeadDays(v.boxShipmentLeadDays);
}
