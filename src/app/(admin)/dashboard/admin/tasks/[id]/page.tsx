import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { DeadlineChip, formatDue } from '@/components/admin/DeadlineChip';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  getAdminPeople,
  getSiblingTasks,
  getTaskEvents,
  getTaskSteps,
  getWorkTask,
  type WorkTask,
} from '@/data/domains/(admin)/tasks/queries';
import { hasAdminPermission } from '@/lib/utils';
import {
  WORK_LINE_LABELS,
  WORK_PRIORITY_LABELS,
  deadlineState,
  describeEvent,
  formatSpan,
  pathSteps,
  stepLabel,
  type TaskStep,
  type WorkTaskEvent,
} from '@/lib/work-tasks';
import { TaskControls } from './TaskControls';

export const dynamic = 'force-dynamic';

/** الصفحة dynamic فالوقت وقت الطلب؛ معزول هنا عشان قاعدة نقاء الرسم. */
function serverNow() {
  return Date.now();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PathNode = { step: string; label: string; state: 'passed' | 'current' | 'upcoming'; reachedAt: string | null };

/**
 * مسار الطلب/المشروع كله: مراحل النوع بترتيبها، فين وصلنا، ومتى وصلنا كل مرحلة.
 * (بيتحسب من مهام نفس الطلب + سجلها — مراجعة الدفع والتنفيذ مهمتين لنفس الطلب.)
 */
function buildPath(catalog: TaskStep[], task: WorkTask, siblings: WorkTask[], events: WorkTaskEvent[]): PathNode[] {
  const openOne = siblings.find((s) => s.status === 'open');
  const currentKey = openOne?.step ?? null;

  const reached = new Map<string, string>();
  for (const e of events) {
    if ((e.kind === 'created' || e.kind === 'step' || e.kind === 'reopened') && e.toValue && !reached.has(e.toValue)) {
      reached.set(e.toValue, e.createdAt);
    }
  }

  const nodes = pathSteps(catalog, task.line).filter((s) => s.step !== 'on_hold' || s.step === currentKey);
  const keys = nodes.map((n) => n.step);
  if (currentKey && !keys.includes(currentKey)) {
    nodes.push({
      line: task.line, step: currentKey, label: stepLabel(catalog, task.line, currentKey, openOne?.stage ?? task.stage),
      hint: null, slaHours: null, ownerKind: 'rule', sortOrder: 999, showTab: true,
    });
  }
  const currentIdx = currentKey ? nodes.findIndex((n) => n.step === currentKey) : -1;

  return nodes.map((n, i): PathNode => {
    const reachedAt = reached.get(n.step) ?? null;
    let state: PathNode['state'];
    if (currentKey) state = i === currentIdx ? 'current' : i < currentIdx ? 'passed' : 'upcoming';
    else state = reachedAt ? 'passed' : 'upcoming';
    return { step: n.step, label: n.label, state, reachedAt };
  });
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user.role !== 'super_admin' && user.role !== 'general_supervisor') return <Unauthorized />;

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const task = await getWorkTask(id);
  if (!task) notFound();

  const [siblings, people, catalog] = await Promise.all([
    getSiblingTasks(task.line, task.sourceId),
    getAdminPeople(),
    getTaskSteps(),
  ]);
  const events = (await getTaskEvents(siblings.map((s) => s.id))) ?? [];
  const steps = catalog ?? [];
  const names = new Map(people.map((p) => [p.id, p]));
  const canAssign = hasAdminPermission(user, 'canAssignWork');

  const now = serverNow();
  const d = deadlineState(task, now);
  const path = buildPath(steps, task, siblings, events);
  const label = (line: WorkTask['line'], step: string, stage: WorkTask['stage']) => stepLabel(steps, line, step, stage);
  const hint = steps.find((s) => s.line === task.line && s.step === task.step)?.hint;

  const timeline = [...events].reverse().map((e) => {
    const owner = siblings.find((s) => s.id === e.taskId) ?? task;
    return {
      e,
      ...describeEvent(e, {
        personName: (pid) => names.get(pid)?.name,
        stepName: (s) => label(owner.line, s, owner.stage),
        formatTime: formatDue,
      }),
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader title="تفاصيل المهمة" backHref="/dashboard/admin/tasks" />

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-700">
            {WORK_LINE_LABELS[task.line]}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-800">
            {label(task.line, task.step, task.stage)}
          </span>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold ${task.status === 'open' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}
          >
            {task.status === 'open' ? 'مفتوحة' : 'اتقفلت'}
          </span>
          {task.priority !== 'normal' && (
            <span className="rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-800">
              أولوية {WORK_PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {task.reference && (
            <span dir="ltr" className="font-mono text-sm font-bold text-slate-900">
              {task.reference}
            </span>
          )}
        </div>
        <h2 className="text-xl font-black text-slate-900">{task.title}</h2>
        {hint && <p className="text-sm font-medium text-slate-600">{hint}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <DeadlineChip d={d} dueAt={task.dueAt} />
          {task.dueAt && <span className="text-sm font-medium text-slate-600">الموعد: {formatDue(task.dueAt)}</span>}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-slate-500">المسؤول</dt>
            <dd className="font-bold text-slate-900">
              {task.assigneeIds.length
                ? task.assigneeIds
                    .map((pid) => {
                      const p = names.get(pid);
                      return p ? `${p.name}${p.roleName ? ` (${p.roleName})` : ''}` : 'إداري';
                    })
                    .join('، ')
                : 'من غير مسؤول — لكل الإدارة'}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">اتفتحت</dt>
            <dd className="font-bold text-slate-900">{formatDue(task.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">في المرحلة الحالية من</dt>
            <dd className="font-bold text-slate-900">
              {formatDue(task.stepChangedAt)}
              {task.status === 'open' && <span className="mr-2 font-medium text-slate-500">({formatSpan(now - new Date(task.stepChangedAt).getTime())})</span>}
            </dd>
          </div>
          {task.doneAt && (
            <div>
              <dt className="font-bold text-slate-500">اتقفلت</dt>
              <dd className="font-bold text-slate-900">{formatDue(task.doneAt)}</dd>
            </div>
          )}
        </dl>

        <Link
          href={task.link}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 font-bold text-white hover:bg-slate-800"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" /> افتح الطلب / المشروع
        </Link>
      </section>

      {path.length > 0 && (
        <section aria-labelledby="path" className="space-y-4">
          <h2 id="path" className="text-lg font-black text-slate-800">
            المسار: فين وصلنا
          </h2>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {path.map((n) => (
              <li
                key={n.step}
                aria-current={n.state === 'current' ? 'step' : undefined}
                className={`flex items-start gap-3 rounded-2xl border p-3 ${
                  n.state === 'current'
                    ? 'border-blue-300 bg-blue-50'
                    : n.state === 'passed'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white opacity-70'
                }`}
              >
                {n.state === 'passed' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Circle className={`mt-0.5 h-5 w-5 shrink-0 ${n.state === 'current' ? 'text-blue-700' : 'text-slate-400'}`} aria-hidden="true" />
                )}
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    {n.label}
                    {n.state === 'current' && <span className="mr-2 text-xs font-bold text-blue-800">(دلوقتي)</span>}
                  </span>
                  {n.reachedAt && <span className="block text-xs font-medium text-slate-500">وصلت {formatDue(n.reachedAt)}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <TaskControls
        taskId={task.id}
        open={task.status === 'open'}
        dueAt={task.dueAt}
        priority={task.priority}
        assigneeIds={task.assigneeIds}
        people={people}
        me={user.id}
        canAssign={canAssign}
      />

      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="text-lg font-black text-slate-800">
          السجل
        </h2>
        {catalog === null && (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
            السجل بيشتغل بعد تطبيق migration «مواعيد المهام».
          </p>
        )}
        {timeline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-bold text-slate-500">
            مفيش تطورات متسجّلة.
          </p>
        ) : (
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {timeline.map(({ e, who, text }) => (
              <li key={e.id} className="px-4 py-3">
                <p className={`text-sm font-bold ${e.kind === 'reminder_overdue' ? 'text-rose-800' : e.kind === 'reminder_soon' ? 'text-amber-900' : 'text-slate-800'}`}>
                  <span className="text-slate-500">{who}:</span> {text}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">{formatDue(e.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
