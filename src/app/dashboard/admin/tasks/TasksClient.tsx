'use client';
import { useNow } from '@/components/providers/ClientTimeProvider';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Check, Inbox } from 'lucide-react';
import type { AdminPerson, WorkTask } from '@/data/domains/work-tasks';
import { completeWorkTask, reassignWorkTask } from '@/actions/work-tasks';
import { WORK_LINES, WORK_LINE_LABELS, WORK_STAGE_LABELS, type WorkLine, type WorkStage } from '@/lib/work-tasks';
import { Field, Select, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { formatCairo } from '@/lib/timezone';

type View = 'mine' | 'open' | 'unassigned' | 'done';

const VIEWS: { key: View; label: string }[] = [
  { key: 'mine', label: 'المسندة ليا' },
  { key: 'open', label: 'كل المفتوحة' },
  { key: 'unassigned', label: 'من غير مسؤول' },
  { key: 'done', label: 'اتقفلت (آخر ١٤ يوم)' },
];

/** من قد إيه — «من ٣ ساعات» / «من يومين». */
function ago(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `من ${mins.toLocaleString('ar-EG')} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `من ${hours.toLocaleString('ar-EG')} ساعة`;
  return `من ${Math.round(hours / 24).toLocaleString('ar-EG')} يوم`;
}

export function TasksClient({ tasks, people, me }: { tasks: WorkTask[]; people: AdminPerson[]; me: string }) {
  const now = useNow();
  const router = useRouter();
  const [view, setView] = useState<View>('mine');
  const [line, setLine] = useState<WorkLine | ''>('');
  const [stage, setStage] = useState<WorkStage | ''>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const names = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);

  const inView = (t: WorkTask, v: View) =>
    v === 'done'
      ? t.status === 'done'
      : t.status === 'open' &&
        (v === 'open' || (v === 'mine' ? t.assigneeIds.includes(me) : t.assigneeIds.length === 0));

  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, tasks.filter((t) => inView(t, v.key)).length])) as Record<View, number>;

  const shown = tasks.filter(
    (t) => inView(t, view) && (!line || t.line === line) && (!stage || t.stage === stage),
  );

  const run = async (id: string, key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key);
    setRowError(null);
    try {
      const r = await fn();
      if (!r.ok) setRowError({ id, message: r.error ?? 'تعذّر التنفيذ' });
      else router.refresh();
    } catch {
      setRowError({ id, message: 'حصل خطأ غير متوقع — جرّب تاني' });
    } finally {
      setBusy(null);
    }
  };

  const chip = (active: boolean) =>
    'inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ' +
    (active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400');

  return (
    <div className="space-y-6">
      <nav aria-label="المهام" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => setView(v.key)} className={chip(view === v.key)} aria-pressed={view === v.key}>
            {v.label}
            <span className={`rounded-full px-2 text-xs ${view === v.key ? 'bg-white/20' : 'bg-slate-100'}`}>
              {counts[v.key].toLocaleString('ar-EG')}
            </span>
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <Field label="النوع">
          <Select value={line} onChange={(e) => setLine(e.target.value as WorkLine | '')}>
            <option value="">كل الأنواع</option>
            {WORK_LINES.map((l) => (
              <option key={l} value={l}>
                {WORK_LINE_LABELS[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المرحلة">
          <Select value={stage} onChange={(e) => setStage(e.target.value as WorkStage | '')}>
            <option value="">الكل</option>
            <option value="payment">{WORK_STAGE_LABELS.payment}</option>
            <option value="fulfilment">{WORK_STAGE_LABELS.fulfilment}</option>
          </Select>
        </Field>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
          <p className="font-bold text-slate-700">
            {view === 'mine' ? 'مفيش حاجة مطلوبة منك دلوقتي.' : 'مفيش مهام هنا.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => (
            <li
              key={t.id}
              className={`rounded-2xl border bg-white p-5 ${t.status === 'open' && t.stage === 'payment' ? 'border-amber-300' : 'border-slate-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-700">
                      {WORK_LINE_LABELS[t.line]}
                    </span>
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-bold ${t.stage === 'payment' ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-800'}`}
                    >
                      {WORK_STAGE_LABELS[t.stage]}
                    </span>
                    {t.reference && (
                      <span dir="ltr" className="font-mono text-sm font-bold text-slate-900">
                        {t.reference}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-bold text-slate-800">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.status === 'done' && t.doneAt
                      ? `اتقفلت ${formatCairo(t.doneAt, { dateStyle: 'medium', timeStyle: 'short' })}`
                      : `مفتوحة ${ago(t.createdAt, now)}`}
                    {' · '}
                    {t.assigneeIds.length
                      ? `المسؤول: ${t.assigneeIds.map((id) => names[id] ?? 'إداري').join('، ')}`
                      : 'من غير مسؤول'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={t.link}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 font-bold text-white hover:bg-slate-800"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> افتح
                  </Link>
                  {t.status === 'open' && (
                    <BusyButton
                      variant="secondary"
                      busy={busy === `done:${t.id}`}
                      pendingLabel="جارٍ القفل…"
                      disabled={busy !== null}
                      onClick={() => run(t.id, `done:${t.id}`, () => completeWorkTask(t.id))}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" /> تم
                    </BusyButton>
                  )}
                </div>
              </div>

              {t.status === 'open' && (
                <div className="mt-4 max-w-sm">
                  <Field label="سنّدها لـ" hint="المسؤول الجديد بيوصله إشعار.">
                    <Select
                      value=""
                      disabled={busy !== null}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        const ids = v === '__none' ? [] : [v];
                        run(t.id, `assign:${t.id}`, () => reassignWorkTask(t.id, ids));
                      }}
                    >
                      <option value="">{busy === `assign:${t.id}` ? 'جارٍ التغيير…' : 'اختار…'}</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.id === me ? ' (أنا)' : ''}
                        </option>
                      ))}
                      <option value="__none">— من غير مسؤول —</option>
                    </Select>
                  </Field>
                </div>
              )}

              {rowError?.id === t.id && <FormError message={rowError.message} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
