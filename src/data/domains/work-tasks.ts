import { createClient } from '@/lib/supabase/server';
import { isWorkLine, isWorkStage, type WorkLine, type WorkStage } from '@/lib/work-tasks';

export type AdminPerson = { id: string; name: string };

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

/** الإداريين — اللي ينفع يتسند لهم. */
export async function getAdminPeople(): Promise<AdminPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('role', ['super_admin', 'general_supervisor'])
    .order('full_name');
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name }));
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
