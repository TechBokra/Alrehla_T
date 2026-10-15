'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import {
  addWorkTaskNote,
  completeWorkTask,
  reassignWorkTask,
  setWorkTaskDue,
  setWorkTaskPriority,
} from '@/actions/work-tasks';
import { BusyButton, Field, Select, TextArea, fieldClass } from '@/components/forms/Form';
import { PersonPicker } from '@/components/admin/PersonPicker';
import { FormError } from '@/components/ui/FormError';
import { cairoParts, cairoWallClockToUtc } from '@/lib/timezone';
import { WORK_PRIORITIES, WORK_PRIORITY_LABELS, isWorkPriority, type WorkPriority } from '@/lib/work-tasks';
import type { AdminPerson } from '@/data/domains/(admin)/tasks/queries';

type Result = { ok: boolean; error?: string; warning?: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** لحظة ← قيمة `datetime-local` بساعة الحيطة في القاهرة. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const p = cairoParts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** قيمة `datetime-local` (القاهرة) ← ISO UTC، أو null لو مش مظبوطة. */
function fromLocalInput(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return cairoWallClockToUtc({
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  }).toISOString();
}

/**
 * أدوات المهمة: المسؤول · الموعد · الأولوية · «تم» · ملاحظة.
 * كل واحدة بتنادي أكشن بيرجّع `{ ok, error }` والخطأ بيظهر تحت أداته.
 */
export function TaskControls({
  taskId,
  open,
  dueAt,
  priority,
  assigneeIds,
  people,
  me,
  canAssign,
}: {
  taskId: string;
  open: boolean;
  dueAt: string | null;
  priority: WorkPriority;
  assigneeIds: string[];
  people: AdminPerson[];
  me: string;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [due, setDue] = useState(toLocalInput(dueAt));
  const [note, setNote] = useState('');

  const run = async (key: string, fn: () => Promise<Result>, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError({ key, message: r.error ?? 'تعذّر التنفيذ' });
      else {
        if (r.warning) setError({ key, message: r.warning });
        after?.();
        router.refresh();
      }
    } catch {
      setError({ key, message: 'حصل خطأ غير متوقع — جرّب تاني' });
    } finally {
      setBusy(null);
    }
  };

  const plusHours = (h: number) => setDue(toLocalInput(new Date(Date.now() + h * 3_600_000).toISOString()));
  const quick = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-400';
  const err = (key: string) => (error?.key === key ? <FormError message={error.message} /> : null);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {open && (
        <section aria-labelledby="who" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 id="who" className="text-lg font-black text-slate-800">
            المسؤول
          </h2>
          {canAssign ? (
            <PersonPicker
              people={people}
              value={assigneeIds}
              me={me}
              disabled={busy !== null}
              emptyLabel="شيل المسؤول — تبقى لكل الإدارة"
              hint={busy === 'assign' ? 'جارٍ التغيير…' : 'المسؤول الجديد بيوصله إشعار في «مهامي».'}
              onChange={(ids) => run('assign', () => reassignWorkTask(taskId, ids))}
            />
          ) : (
            <p className="text-sm font-medium text-slate-600">تغيير المسؤول محتاج صلاحية «توزيع المهام والطلبات».</p>
          )}
          {err('assign')}
        </section>
      )}

      {open && (
        <section aria-labelledby="done" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 id="done" className="text-lg font-black text-slate-800">
            إنهاء المهمة
          </h2>
          <p className="text-sm font-medium text-slate-600">
            لو الشغل خلص من غير ما حالة الطلب تتغيّر. التقفيل بيتسجّل «في الميعاد» أو «متأخر» حسب الموعد.
          </p>
          <BusyButton
            variant="secondary"
            busy={busy === 'done'}
            pendingLabel="جارٍ القفل…"
            disabled={busy !== null}
            onClick={() => run('done', () => completeWorkTask(taskId))}
          >
            <Check className="h-4 w-4" aria-hidden="true" /> تم
          </BusyButton>
          {err('done')}
        </section>
      )}

      {open && canAssign && (
        <section aria-labelledby="due" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 id="due" className="text-lg font-black text-slate-800">
            الموعد
          </h2>
          <Field label="موعد التسليم (بتوقيت القاهرة)" hint="بيتحسب تلقائيًا من مهلة المرحلة، وده تعديل يدوي عليه.">
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              disabled={busy !== null}
              className={fieldClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quick} onClick={() => plusHours(4)}>
              بعد ٤ ساعات
            </button>
            <button type="button" className={quick} onClick={() => plusHours(24)}>
              بعد يوم
            </button>
            <button type="button" className={quick} onClick={() => plusHours(72)}>
              بعد ٣ أيام
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <BusyButton
              busy={busy === 'due'}
              pendingLabel="جارٍ الحفظ…"
              disabled={busy !== null || !due}
              onClick={() => {
                const iso = fromLocalInput(due);
                if (!iso) return setError({ key: 'due', message: 'الموعد مش مظبوط' });
                return run('due', () => setWorkTaskDue(taskId, iso));
              }}
            >
              حفظ الموعد
            </BusyButton>
            {dueAt && (
              <BusyButton
                variant="secondary"
                busy={busy === 'due-clear'}
                pendingLabel="جارٍ الشيل…"
                disabled={busy !== null}
                onClick={() => run('due-clear', () => setWorkTaskDue(taskId, null), () => setDue(''))}
              >
                شيل الموعد
              </BusyButton>
            )}
          </div>
          {err('due')}
          {err('due-clear')}
        </section>
      )}

      {canAssign && (
        <section aria-labelledby="prio" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 id="prio" className="text-lg font-black text-slate-800">
            الأولوية
          </h2>
          <Field label="الأولوية" hint="العاجلة والعالية بتطلع قبل غيرها وسط المهام اللي ليها نفس حالة الموعد.">
            <Select
              value={priority}
              disabled={busy !== null || !open}
              onChange={(e) => {
                const v = e.target.value;
                if (isWorkPriority(v)) void run('prio', () => setWorkTaskPriority(taskId, v));
              }}
            >
              {WORK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {WORK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          {err('prio')}
        </section>
      )}

      <section aria-labelledby="note" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
        <h2 id="note" className="text-lg font-black text-slate-800">
          ملاحظة على المهمة
        </h2>
        <Field label="ملاحظة" hint="بتظهر في سجل المهمة باسمك — مثلًا: «بانتظار رد العميل» أو «اتكلمت مع المدرب».">
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            disabled={busy !== null}
          />
        </Field>
        <BusyButton
          busy={busy === 'note'}
          pendingLabel="جارٍ الحفظ…"
          disabled={busy !== null || note.trim() === ''}
          onClick={() => run('note', () => addWorkTaskNote(taskId, note), () => setNote(''))}
        >
          إضافة الملاحظة
        </BusyButton>
        {err('note')}
      </section>
    </div>
  );
}
