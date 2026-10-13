'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminPerson } from '@/data/domains/(admin)/tasks/queries';
import { saveAssignmentRule } from '@/actions/work-tasks';
import {
  WORK_LINES,
  WORK_LINE_LABELS,
  WORK_STAGES,
  WORK_STAGE_HINTS,
  WORK_STAGE_LABELS,
} from '@/lib/work-tasks';
import { Checkbox, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

export function AssignmentsClient({ rules, people }: { rules: Record<string, string[]>; people: AdminPerson[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string[]>>(rules);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const toggle = (key: string, id: string, on: boolean) =>
    setDraft((d) => {
      const cur = d[key] ?? [];
      return { ...d, [key]: on ? [...cur, id] : cur.filter((x) => x !== id) };
    });

  const save = async (line: string, stage: string) => {
    const key = `${line}:${stage}`;
    setBusy(key);
    setError(null);
    setSaved(null);
    try {
      const r = await saveAssignmentRule(line, stage, draft[key] ?? []);
      if (!r.ok) setError({ key, message: r.error });
      else {
        setSaved(key);
        router.refresh();
      }
    } catch {
      setError({ key, message: 'حصل خطأ غير متوقع — جرّب تاني' });
    } finally {
      setBusy(null);
    }
  };

  if (people.length === 0) {
    return <p className="font-bold text-slate-700">مفيش حسابات إدارية لسه.</p>;
  }

  return (
    <div className="space-y-8">
      {WORK_LINES.map((line) => (
        <section key={line} className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-black text-slate-800">{WORK_LINE_LABELS[line]}</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {WORK_STAGES.map((stage) => {
              const key = `${line}:${stage}`;
              const chosen = draft[key] ?? [];
              return (
                <fieldset key={stage} className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <legend className="sr-only">{WORK_STAGE_LABELS[stage]}</legend>
                  <div>
                    <p className="font-bold text-slate-800">{WORK_STAGE_LABELS[stage]}</p>
                    <p className="text-xs font-medium text-slate-500">{WORK_STAGE_HINTS[stage]}</p>
                  </div>
                  <div className="space-y-2">
                    {people.map((p) => (
                      <Checkbox
                        key={p.id}
                        label={p.name}
                        checked={chosen.includes(p.id)}
                        onChange={(e) => toggle(key, p.id, e.target.checked)}
                      />
                    ))}
                  </div>
                  {error?.key === key && <FormError message={error.message} />}
                  <div className="flex items-center gap-3">
                    <BusyButton busy={busy === key} disabled={busy !== null} onClick={() => save(line, stage)}>
                      حفظ
                    </BusyButton>
                    {saved === key && <span className="text-sm font-bold text-emerald-700">اتحفظ ✓</span>}
                    {chosen.length === 0 && (
                      <span className="text-xs font-bold text-amber-700">من غير مسؤول — بيظهر لكل الإدارة</span>
                    )}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
