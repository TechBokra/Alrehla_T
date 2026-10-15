import { type WorkLine, type WorkStage, isWorkLine, isWorkStage } from '@/lib/work-tasks';
import { createClient } from '@/lib/supabase/server';

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
};

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
  return (data ?? [])
    .filter((t) => isWorkLine(t.line) && isWorkStage(t.stage))
    .map((t) => ({
      id: t.id,
      line: t.line as WorkLine,
      stage: t.stage as WorkStage,
      sourceId: t.source_id,
      reference: t.reference,
      title: t.title,
      link: t.link,
      assigneeIds: t.assignee_ids ?? [],
      status: t.status === 'done' ? 'done' : 'open',
      createdAt: t.created_at,
      doneAt: t.done_at,
    }));
}
