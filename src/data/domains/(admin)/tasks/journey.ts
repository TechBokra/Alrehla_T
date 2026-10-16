import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getStudioFlow, getStudioProjectForOrder } from '@/data/domains/(admin)/studio/queries';
import { getTaskSteps } from '@/data/domains/(admin)/tasks/queries';
import {
  flowPipeline,
  flowStep,
  isHold,
  isTerminalIn,
  ownerLabelOf,
  statusTone,
  type StudioFlow,
} from '@/lib/studio-flow';
import type { StudioTone } from '@/lib/studio';
import { shipmentDueDate } from '@/lib/box-schedule';
import {
  deadlineState,
  isWorkLine,
  stepLabel,
  type DeadlineState,
  type TaskStep,
  type WorkLine,
} from '@/lib/work-tasks';

/**
 * رحلة الطلب — مكان واحد يوري الطلب من الدفع للتسليم: مهام الطلب نفسه (مراجعة الدفع ثم التنفيذ
 * بمراحله) + مشروع/مشاريع الاستوديو لبنوده المخصّصة بمرحلتها الحالية ومسؤولها وموعدها.
 * الاستوديو هنا مرحلة من رحلة الطلب، مش عالم منفصل.
 */

export type JourneyStep = {
  id: string;
  label: string;
  state: 'done' | 'current' | 'open';
  assignees: string[];
  dueAt: string | null;
  deadline: DeadlineState;
  href: string;
};

export type JourneyProject = {
  id: string;
  title: string;
  stageLabel: string;
  tone: StudioTone;
  held: boolean;
  terminal: boolean;
  orderClosed: boolean;
  owner: string;
  assignees: string[];
  dueAt: string | null;
  deadline: DeadlineState | null;
  taskId: string | null;
  pipeline: { key: string; label: string; state: 'done' | 'current' | 'todo' }[];
};

export type JourneyShipment = {
  id: string;
  month: number;
  months: number;
  status: string;
  dueAt: string;
  taskId: string | null;
  taskOpen: boolean;
  assignees: string[];
  deadline: DeadlineState | null;
};

export type OrderJourneyData = { steps: JourneyStep[]; projects: JourneyProject[]; shipments: JourneyShipment[] };

type Row = {
  id: string;
  line: string;
  stage: string;
  source_id: string;
  status: string;
  assignee_ids: string[] | null;
  created_at: string;
  done_at: string | null;
  step?: string | null;
  step_changed_at?: string | null;
  due_at?: string | null;
};

export async function getOrderJourney(orderId: string): Promise<OrderJourneyData> {
  const supabase = await createClient();
  const [projects, { flow, engine }, catalog, orderTasks] = await Promise.all([
    getStudioProjectForOrder(orderId),
    getStudioFlow(),
    getTaskSteps(),
    supabase.from('work_tasks').select('*').eq('source_id', orderId).order('created_at', { ascending: true }).limit(20),
  ]);
  void engine;

  const projectIds = projects.map((p) => p.id);
  const studioTasks = projectIds.length
    ? await supabase.from('work_tasks').select('*').eq('line', 'studio').in('source_id', projectIds).limit(40)
    : { data: [] as Row[], error: null };

  // شحنات اشتراك الصندوق: لكل شهر مهمة مستقلة (source_id = رقم الشحنة) بموعد الشحنة نفسه.
  const sub = await supabase
    .from('box_subscriptions')
    .select('id, starts_at, months, status')
    .eq('order_id', orderId)
    .maybeSingle();
  const shipRows = sub.data
    ? ((
        await supabase
          .from('box_shipments')
          .select('id, month_number, status')
          .eq('subscription_id', sub.data.id)
          .order('month_number', { ascending: true })
          .limit(24)
      ).data ?? [])
    : [];
  const shipTasks = shipRows.length
    ? (((
        await supabase
          .from('work_tasks')
          .select('*')
          .eq('line', 'box')
          .in(
            'source_id',
            shipRows.map((r) => r.id),
          )
          .limit(48)
      ).data ?? []) as Row[])
    : [];

  const orderRows = (orderTasks.data ?? []) as Row[];
  const studioRows = (studioTasks.data ?? []) as Row[];
  const ids = Array.from(new Set([...orderRows, ...studioRows, ...shipTasks].flatMap((t) => t.assignee_ids ?? [])));
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from('user_profiles').select('id, full_name').in('id', ids);
    for (const p of data ?? []) names.set(p.id, p.full_name);
  }
  const who = (list: string[] | null) => (list ?? []).map((id) => names.get(id) ?? 'إداري');
  const now = Date.now();
  const cat: TaskStep[] = catalog ?? [];

  const steps: JourneyStep[] = orderRows
    .filter((t) => isWorkLine(t.line) && t.line !== 'studio')
    .map((t) => {
      const line = t.line as WorkLine;
      const stage = t.stage === 'payment' ? 'payment' : 'fulfilment';
      const step = t.step || t.stage;
      const open = t.status === 'open';
      const dueAt = t.due_at ?? null;
      return {
        id: t.id,
        label: stepLabel(cat, line, step, stage),
        state: open ? 'current' : 'done',
        assignees: who(t.assignee_ids),
        dueAt,
        deadline: deadlineState(
          { status: open ? 'open' : 'done', dueAt, stepChangedAt: t.step_changed_at ?? t.created_at, doneAt: t.done_at },
          now,
        ),
        href: `/dashboard/admin/tasks/${t.id}`,
      } satisfies JourneyStep;
    });

  const byProject = new Map(studioRows.map((t) => [t.source_id, t]));
  const projectsOut: JourneyProject[] = projects.map((p) => {
    const task = byProject.get(p.id);
    const open = task?.status === 'open';
    const pipe = flowPipeline(flow);
    const placeKey = isHold(flow, p.status) ? (p.heldFrom ?? '') : p.status;
    const idx = pipe.findIndex((s) => s.step === placeKey);
    const dueAt = open ? (task?.due_at ?? null) : null;
    return {
      id: p.id,
      title: p.childName ? `قصة ${p.childName}` : 'قصة مخصّصة',
      stageLabel: flowStep(flow, p.status)?.label ?? p.status,
      tone: statusTone(p.status, flow),
      held: isHold(flow, p.status),
      terminal: isTerminalIn(flow, p.status),
      orderClosed: p.orderClosed,
      owner: ownerLabelOf(flow, p.status),
      assignees: open ? who(task?.assignee_ids ?? null) : [],
      dueAt,
      deadline: open
        ? deadlineState({ status: 'open', dueAt, stepChangedAt: task?.step_changed_at ?? task?.created_at ?? null }, now)
        : null,
      taskId: task?.id ?? null,
      pipeline: pipe.map((s, i) => ({
        key: s.step,
        label: s.label,
        state: idx < 0 ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo',
      })),
    };
  });

  const subRow = sub.data;
  const startsAt = subRow?.starts_at ?? null;
  const totalMonths = subRow?.months ?? shipRows.length;
  const shipments: JourneyShipment[] = startsAt
    ? shipRows.map((r) => {
        const task = shipTasks.find((t) => t.source_id === r.id);
        const open = task?.status === 'open';
        const dueAt = shipmentDueDate(startsAt, r.month_number).toISOString();
        return {
          id: r.id,
          month: r.month_number,
          months: totalMonths,
          status: r.status,
          dueAt,
          taskId: task?.id ?? null,
          taskOpen: open,
          assignees: open ? who(task?.assignee_ids ?? null) : [],
          deadline: open
            ? deadlineState(
                { status: 'open', dueAt: task?.due_at ?? dueAt, stepChangedAt: task?.step_changed_at ?? task?.created_at ?? null },
                now,
              )
            : null,
        } satisfies JourneyShipment;
      })
    : [];

  return { steps, projects: projectsOut, shipments };
}

export type { StudioFlow };
