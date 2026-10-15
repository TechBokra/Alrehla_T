'use client';
import { useNow } from '@/components/providers/ClientTimeProvider';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ExternalLink,
  Check,
  Inbox,
  Users,
  Flame,
  ChevronLeft,
} from 'lucide-react';
import type { AdminPerson, RecentTaskEvent, WorkTask } from '@/data/domains/(admin)/tasks/queries';
import { completeWorkTask, reassignWorkTask } from '@/actions/work-tasks';
import {
  WORK_LINES,
  WORK_LINE_LABELS,
  WORK_PRIORITY_LABELS,
  deadlineRank,
  deadlineState,
  describeEvent,
  formatSpan,
  pathSteps,
  priorityRank,
  stepLabel,
  type DeadlineState,
  type TaskStep,
  type WorkLine,
} from '@/lib/work-tasks';
import { Field, Select, BusyButton } from '@/components/forms/Form';
import { PersonPicker } from '@/components/admin/PersonPicker';
import { FormError } from '@/components/ui/FormError';
import { formatCairo } from '@/lib/timezone';
import { DeadlineChip, formatDue } from '@/components/admin/DeadlineChip';

type View = 'overview' | 'mine' | 'overdue' | 'soon' | 'open' | 'unassigned' | 'done';

const DAY = 86_400_000;

/** من قد إيه — «من ٣ ساعات» / «من يومين». */
function ago(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `من ${mins.toLocaleString('ar-EG')} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `من ${hours.toLocaleString('ar-EG')} ساعة`;
  return `من ${Math.round(hours / 24).toLocaleString('ar-EG')} يوم`;
}

const fmtDue = formatDue;

type Row = { t: WorkTask; d: DeadlineState };

export function TasksClient({
  tasks,
  people,
  steps,
  events,
  me,
  isManager,
  canAssign,
}: {
  tasks: WorkTask[];
  people: AdminPerson[];
  steps: TaskStep[];
  events: RecentTaskEvent[];
  me: string;
  /** المدير العام / حامل «توزيع المهام»: عنده نظرة شاملة. */
  isManager: boolean;
  canAssign: boolean;
}) {
  const now = useNow();
  const router = useRouter();
  const [view, setView] = useState<View>(isManager ? 'overview' : 'mine');
  const [line, setLine] = useState<WorkLine | ''>('');
  const [step, setStep] = useState('');
  const [person, setPerson] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const names = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);

  const rows: Row[] = useMemo(
    () => tasks.map((t) => ({ t, d: deadlineState(t, now) })),
    [tasks, now],
  );
  const open = useMemo(() => rows.filter((r) => r.t.status === 'open'), [rows]);

  const inView = (r: Row, v: View): boolean => {
    if (v === 'done') return r.t.status === 'done';
    if (r.t.status !== 'open') return false;
    switch (v) {
      case 'mine':
        return r.t.assigneeIds.includes(me);
      case 'overdue':
        return r.d.kind === 'overdue';
      case 'soon':
        return r.d.kind === 'soon';
      case 'unassigned':
        return r.t.assigneeIds.length === 0;
      default:
        return true;
    }
  };

  const counts: Record<View, number> = {
    overview: 0,
    mine: rows.filter((r) => inView(r, 'mine')).length,
    overdue: rows.filter((r) => inView(r, 'overdue')).length,
    soon: rows.filter((r) => inView(r, 'soon')).length,
    open: open.length,
    unassigned: rows.filter((r) => inView(r, 'unassigned')).length,
    done: rows.filter((r) => inView(r, 'done')).length,
  };

  const lineSteps = useMemo(() => (line ? pathSteps(steps, line) : []), [steps, line]);

  const matches = (r: Row) =>
    (!line || r.t.line === line) &&
    (!step || r.t.step === step) &&
    (!person || (person === 'none' ? r.t.assigneeIds.length === 0 : r.t.assigneeIds.includes(person)));

  const byUrgency = (a: Row, b: Row) =>
    deadlineRank(a.d.kind) - deadlineRank(b.d.kind) ||
    priorityRank(a.t.priority) - priorityRank(b.t.priority) ||
    (a.t.dueAt ?? '9').localeCompare(b.t.dueAt ?? '9') ||
    b.t.createdAt.localeCompare(a.t.createdAt);

  const shown = rows
    .filter((r) => view !== 'overview' && inView(r, view) && matches(r))
    .sort(
      view === 'done'
        ? (a, b) => (b.t.doneAt ?? '').localeCompare(a.t.doneAt ?? '')
        : byUrgency,
    );

  // ── أرقام النظرة الشاملة ──────────────────────────────────────────────────
  const overview = useMemo(() => {
    const recentDone = rows.filter(
      (r) => r.t.status === 'done' && r.t.doneAt && now - new Date(r.t.doneAt).getTime() <= 14 * DAY,
    );
    const judged = recentDone.filter((r) => r.d.kind === 'done_on_time' || r.d.kind === 'done_late');
    const onTime = judged.filter((r) => r.d.kind === 'done_on_time').length;

    // حمل كل شخص.
    const load = new Map<string, { open: number; overdue: number; soon: number }>();
    for (const r of open) {
      const owners = r.t.assigneeIds.length ? r.t.assigneeIds : ['none'];
      for (const id of owners) {
        const cur = load.get(id) ?? { open: 0, overdue: 0, soon: 0 };
        cur.open += 1;
        if (r.d.kind === 'overdue') cur.overdue += 1;
        if (r.d.kind === 'soon') cur.soon += 1;
        load.set(id, cur);
      }
    }
    const workload = [...load.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.overdue - a.overdue || b.soon - a.soon || b.open - a.open);

    // المسار: النوع ← المرحلة ← العدد.
    const pipeline = WORK_LINES.map((l) => {
      const mine = open.filter((r) => r.t.line === l);
      if (mine.length === 0) return null;
      const known = pathSteps(steps, l).map((s) => s.step);
      const keys = [...known, ...new Set(mine.map((r) => r.t.step).filter((k) => !known.includes(k)))];
      const cells = keys
        .map((k) => {
          const inStep = mine.filter((r) => r.t.step === k);
          return {
            key: k,
            label: stepLabel(steps, l, k, inStep[0]?.t.stage ?? 'fulfilment'),
            n: inStep.length,
            overdue: inStep.filter((r) => r.d.kind === 'overdue').length,
          };
        })
        .filter((c) => c.n > 0);
      return { line: l, total: mine.length, cells };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return { judged: judged.length, onTime, workload, pipeline };
  }, [rows, open, steps, now]);

  const run = async (
    id: string,
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string; warning?: string }>,
  ) => {
    setBusy(key);
    setRowError(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setRowError({ id, message: r.error ?? 'تعذّر التنفيذ' });
      } else {
        // ⚠️ **نجاح بتحذير بيتحدّث وبيتكلّم**: التسنيد اتحفظ فلازم
        //    الشاشة تعرض المسؤول الجديد، ومع كده الإداري يشوف إن
        //    الإشعار ماوصلش.
        if (r.warning) setRowError({ id, message: r.warning });
        router.refresh();
      }
    } catch {
      setRowError({ id, message: 'حصل خطأ غير متوقع — جرّب تاني' });
    } finally {
      setBusy(null);
    }
  };

  const go = (v: View, f?: { line?: WorkLine | ''; step?: string; person?: string }) => {
    setView(v);
    setLine(f?.line ?? '');
    setStep(f?.step ?? '');
    setPerson(f?.person ?? '');
  };

  const chip = (active: boolean) =>
    'inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ' +
    (active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400');

  const tabs: { key: View; label: string; hide?: boolean }[] = [
    { key: 'overview', label: 'نظرة شاملة', hide: !isManager },
    { key: 'mine', label: 'المسندة ليا' },
    { key: 'overdue', label: 'متأخرة' },
    { key: 'soon', label: 'قربت' },
    { key: 'open', label: 'كل المفتوحة' },
    { key: 'unassigned', label: 'من غير مسؤول' },
    { key: 'done', label: 'اتقفلت (آخر ١٤ يوم)' },
  ];

  const personName = (id: string) => names[id];

  const kpi = (
    label: string,
    value: string,
    tone: 'neutral' | 'danger' | 'warn' | 'good',
    onClick?: () => void,
    sub?: string,
  ) => {
    const toneClass = {
      neutral: 'border-slate-200 bg-white text-slate-900',
      danger: 'border-rose-200 bg-rose-50 text-rose-900',
      warn: 'border-amber-300 bg-amber-50 text-amber-900',
      good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    }[tone];
    const inner = (
      <>
        <span className="block text-3xl font-black">{value}</span>
        <span className="mt-1 block text-sm font-bold">{label}</span>
        {sub && <span className="mt-0.5 block text-xs font-medium opacity-80">{sub}</span>}
      </>
    );
    return onClick ? (
      <button key={label} type="button" onClick={onClick} className={`rounded-2xl border p-4 text-right transition-shadow hover:shadow-md ${toneClass}`}>
        {inner}
      </button>
    ) : (
      <div key={label} className={`rounded-2xl border p-4 ${toneClass}`}>
        {inner}
      </div>
    );
  };

  const n = (x: number) => x.toLocaleString('ar-EG');

  return (
    <div className="space-y-6">
      <nav aria-label="المهام" className="flex flex-wrap gap-2">
        {tabs
          .filter((v) => !v.hide)
          .map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => go(v.key)}
              className={chip(view === v.key)}
              aria-pressed={view === v.key}
            >
              {v.label}
              {v.key !== 'overview' && (
                <span
                  className={`rounded-full px-2 text-xs ${
                    view === v.key
                      ? 'bg-white/20'
                      : v.key === 'overdue' && counts.overdue > 0
                        ? 'bg-rose-100 text-rose-800'
                        : v.key === 'soon' && counts.soon > 0
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100'
                  }`}
                >
                  {n(counts[v.key])}
                </span>
              )}
            </button>
          ))}
      </nav>

      {view === 'overview' && isManager && (
        <div className="space-y-8">
          <section aria-label="ملخص" className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {kpi('مفتوحة', n(counts.open), 'neutral', () => go('open'))}
            {kpi('متأخرة', n(counts.overdue), counts.overdue > 0 ? 'danger' : 'neutral', () => go('overdue'))}
            {kpi('قربت من موعدها', n(counts.soon), counts.soon > 0 ? 'warn' : 'neutral', () => go('soon'))}
            {kpi('من غير مسؤول', n(counts.unassigned), counts.unassigned > 0 ? 'warn' : 'neutral', () => go('unassigned'))}
            {kpi(
              'الالتزام بالمواعيد',
              overview.judged ? `${n(Math.round((overview.onTime / overview.judged) * 100))}٪` : '—',
              overview.judged && overview.onTime / overview.judged < 0.8 ? 'warn' : 'good',
              () => go('done'),
              overview.judged ? `${n(overview.onTime)} من ${n(overview.judged)} خلصت في ميعادها (آخر ١٤ يوم)` : 'لسه مفيش مهام اتقفلت بموعد',
            )}
          </section>

          <section aria-labelledby="urgent" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="urgent" className="flex items-center gap-2 text-lg font-black text-slate-800">
                <Flame className="h-5 w-5 text-rose-600" aria-hidden="true" /> محتاجة تدخّل دلوقتي
              </h2>
              <button type="button" onClick={() => go('open')} className="text-sm font-bold text-blue-800 underline underline-offset-4">
                كل المفتوحة
              </button>
            </div>
            {(() => {
              const urgent = open
                .filter((r) => r.d.kind === 'overdue' || r.d.kind === 'soon' || r.t.priority === 'urgent' || r.t.assigneeIds.length === 0)
                .sort(byUrgency)
                .slice(0, 8);
              return urgent.length === 0 ? (
                <p className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
                  كله ماشي في ميعاده، ومفيش مهمة من غير مسؤول.
                </p>
              ) : (
                <ul className="space-y-2">
                  {urgent.map((r) => (
                    <li key={r.t.id}>
                      <TaskSummary r={r} steps={steps} names={names} now={now} />
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>

          <section aria-labelledby="pipeline" className="space-y-3">
            <h2 id="pipeline" className="text-lg font-black text-slate-800">
              مسار الشغل: كل نوع وهو فين دلوقتي
            </h2>
            {overview.pipeline.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-bold text-slate-500">
                مفيش مهام مفتوحة.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {overview.pipeline.map((p) => (
                  <div key={p.line} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <button type="button" onClick={() => go('open', { line: p.line })} className="font-black text-slate-900 hover:underline">
                        {WORK_LINE_LABELS[p.line]}
                      </button>
                      <span className="text-xs font-bold text-slate-500">{n(p.total)} مفتوحة</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.cells.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => go('open', { line: p.line, step: c.key })}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                            c.overdue > 0 ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-700'
                          } hover:border-slate-400`}
                        >
                          {c.label}
                          <span className="rounded-full bg-white px-2 py-0.5">{n(c.n)}</span>
                          {c.overdue > 0 && (
                            <span className="inline-flex items-center gap-1 text-rose-800">
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {n(c.overdue)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section aria-labelledby="load" className="space-y-3">
              <h2 id="load" className="flex items-center gap-2 text-lg font-black text-slate-800">
                <Users className="h-5 w-5" aria-hidden="true" /> حمل الفريق
              </h2>
              {overview.workload.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-bold text-slate-500">
                  مفيش مهام مفتوحة.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {overview.workload.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => go('open', { person: w.id })}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-slate-900">
                            {w.id === 'none' ? 'من غير مسؤول' : (names[w.id] ?? 'إداري')}
                          </span>
                          {w.id !== 'none' && (
                            <span className="block text-xs font-medium text-slate-500">
                              {people.find((p) => p.id === w.id)?.roleName ?? ''}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs font-bold">
                          {w.overdue > 0 && (
                            <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">متأخرة {n(w.overdue)}</span>
                          )}
                          {w.soon > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">قربت {n(w.soon)}</span>
                          )}
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">مفتوحة {n(w.open)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="feed" className="space-y-3">
              <h2 id="feed" className="text-lg font-black text-slate-800">
                آخر التطورات
              </h2>
              {events.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-bold text-slate-500">
                  لسه مفيش تطورات متسجّلة.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {events.map((e) => {
                    const d = describeEvent(e, {
                      personName,
                      stepName: (s) => stepLabel(steps, e.taskLine, s, e.taskStage),
                      formatTime: fmtDue,
                    });
                    return (
                      <li key={e.id}>
                        <Link href={e.taskLink} className="block px-4 py-3 hover:bg-slate-50">
                          <p className="truncate text-xs font-bold text-slate-500">{e.taskTitle}</p>
                          <p className="mt-0.5 text-sm font-bold text-slate-800">
                            <span className="text-slate-500">{d.who}:</span> {d.text}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-400">{ago(e.createdAt, now)}</p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {view !== 'overview' && (
        <>
          <div className={`grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 ${isManager ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <Field label="النوع">
              <Select
                value={line}
                onChange={(e) => {
                  setLine(e.target.value as WorkLine | '');
                  setStep('');
                }}
              >
                <option value="">كل الأنواع</option>
                {WORK_LINES.map((l) => (
                  <option key={l} value={l}>
                    {WORK_LINE_LABELS[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المرحلة" hint={line ? undefined : 'اختار نوع الأول عشان تشوف مراحله.'}>
              <Select value={step} onChange={(e) => setStep(e.target.value)} disabled={!line || lineSteps.length === 0}>
                <option value="">كل المراحل</option>
                {lineSteps.map((s) => (
                  <option key={s.step} value={s.step}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            {isManager && (
              <Field label="المسؤول">
                <Select value={person} onChange={(e) => setPerson(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="none">من غير مسؤول</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.roleName ? ` — ${p.roleName}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
              <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="font-bold text-slate-700">
                {view === 'mine' ? 'مفيش حاجة مطلوبة منك دلوقتي.' : 'مفيش مهام هنا.'}
              </p>
              {view === 'mine' && isManager && (
                <button type="button" onClick={() => go('overview')} className="mt-3 text-sm font-bold text-blue-800 underline underline-offset-4">
                  افتح النظرة الشاملة
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => (
                <li
                  key={r.t.id}
                  className={`rounded-2xl border bg-white p-5 ${
                    r.d.kind === 'overdue'
                      ? 'border-rose-300'
                      : r.d.kind === 'soon'
                        ? 'border-amber-300'
                        : r.t.status === 'open' && r.t.stage === 'payment'
                          ? 'border-amber-200'
                          : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <TaskSummary r={r} steps={steps} names={names} now={now} bare />
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/admin/tasks/${r.t.id}`}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 font-bold text-slate-700 hover:border-slate-400"
                      >
                        التفاصيل <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href={r.t.link}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 font-bold text-white hover:bg-slate-800"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" /> افتح
                      </Link>
                      {r.t.status === 'open' && (
                        <BusyButton
                          variant="secondary"
                          busy={busy === `done:${r.t.id}`}
                          pendingLabel="جارٍ القفل…"
                          disabled={busy !== null}
                          onClick={() => run(r.t.id, `done:${r.t.id}`, () => completeWorkTask(r.t.id))}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" /> تم
                        </BusyButton>
                      )}
                    </div>
                  </div>

                  {r.t.status === 'open' && canAssign && (
                    <div className="mt-4 max-w-sm">
                      {/* ⚠️ **بحث بالاسم بدل قايمة منسدلة** (ملاحظة تامر، ١٥
                          أكتوبر): القايمة كانت كل الإداريين ورا بعضهم —
                          بتطول وبتتلفّ ومابتفرّقش بين اسمين متشابهين.
                          و`PersonPicker` بيعرض الدور الإداري جنب الاسم. */}
                      <PersonPicker
                        label="سنّدها لـ"
                        hint={
                          busy === `assign:${r.t.id}`
                            ? 'جارٍ التغيير…'
                            : 'المسؤول الجديد بيوصله إشعار في «مهامي».'
                        }
                        people={people}
                        value={r.t.assigneeIds}
                        me={me}
                        disabled={busy !== null}
                        emptyLabel="شيل المسؤول — تبقى لكل الإدارة"
                        onChange={(ids) => run(r.t.id, `assign:${r.t.id}`, () => reassignWorkTask(r.t.id, ids))}
                      />
                    </div>
                  )}

                  {rowError?.id === r.t.id && <FormError message={rowError.message} />}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs font-medium text-slate-500">
            «قربت» = آخر ٢٥٪ من مهلة المرحلة (وبحد أدنى ساعتين قبل الموعد). المهل والمراحل بتتظبط من «المراحل والمواعيد».
          </p>
        </>
      )}
    </div>
  );
}

/** بيانات المهمة: النوع والمرحلة والموعد والمسؤول — بتتعرض في القايمة وفي «محتاجة تدخّل». */
function TaskSummary({
  r,
  steps,
  names,
  now,
  bare = false,
}: {
  r: Row;
  steps: TaskStep[];
  names: Record<string, string>;
  now: number;
  /** من غير إطار (جوّه بطاقة القايمة). */
  bare?: boolean;
}) {
  const { t, d } = r;
  const body = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-700">
          {WORK_LINE_LABELS[t.line]}
        </span>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-bold ${t.stage === 'payment' ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-800'}`}
        >
          {stepLabel(steps, t.line, t.step, t.stage)}
        </span>
        {t.priority !== 'normal' && (
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold ${
              t.priority === 'urgent'
                ? 'bg-rose-100 text-rose-800'
                : t.priority === 'high'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            أولوية {WORK_PRIORITY_LABELS[t.priority]}
          </span>
        )}
        {t.reference && (
          <span dir="ltr" className="font-mono text-sm font-bold text-slate-900">
            {t.reference}
          </span>
        )}
      </div>
      <p className="mt-2 font-bold text-slate-800">{t.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DeadlineChip d={d} dueAt={t.dueAt} />
        {t.status === 'open' && t.dueAt && (
          <span className="text-xs font-medium text-slate-500">الموعد: {fmtDue(t.dueAt)}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {t.status === 'done' && t.doneAt
          ? `اتقفلت ${formatCairo(t.doneAt, { dateStyle: 'medium', timeStyle: 'short' })}`
          : `مفتوحة ${ago(t.createdAt, now)}${
              t.stepChangedAt !== t.createdAt ? ` · في المرحلة دي ${ago(t.stepChangedAt, now)}` : ''
            }`}
        {' · '}
        {t.assigneeIds.length
          ? `المسؤول: ${t.assigneeIds.map((id) => names[id] ?? 'إداري').join('، ')}`
          : 'من غير مسؤول'}
      </p>
    </div>
  );
  if (bare) return body;
  return (
    <Link
      href={`/dashboard/admin/tasks/${t.id}`}
      className={`block rounded-2xl border bg-white p-4 transition-colors hover:border-slate-400 ${
        d.kind === 'overdue' ? 'border-rose-300' : d.kind === 'soon' ? 'border-amber-300' : 'border-slate-200'
      }`}
    >
      {body}
    </Link>
  );
}
