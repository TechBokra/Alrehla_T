'use client';

import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { reportIncident } from '@/actions/incidents';
import { INCIDENT_CATEGORIES } from '@/lib/incidents';
import { useAction } from '@/lib/use-action';
import { Field, Select, TextArea, BusyButton, Checkbox } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

/**
 * «بلّغ عن مشكلة» — للمدرب والطالب وولي الأمر (قرار ٢٤ أكتوبر، بند ١١).
 *
 * البلاغ بيوصل للإدارة فورًا كإشعار، والعاجل بيظهر أحمر فوق لوحة
 * الإدارة لحد ما حد يمسكه.
 */
export function ReportIncident({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [category, setCategory] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [description, setDescription] = useState('');
  const send = useAction(reportIncident, {
    onSuccess: () => {
      setDone(true);
      setOpen(false);
    },
    fallbackError: 'تعذّر إرسال البلاغ — جرّب تاني',
  });
  const fieldError = (f: string) => (send.errorField === f ? send.error : undefined);
  const safety = category === 'child_safety';
  const hint = INCIDENT_CATEGORIES.find((c) => c.value === category)?.hint;

  if (done) {
    return (
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
        البلاغ وصل للإدارة. هنتواصل معاك، وهيوصلك إشعار لما يتقفل.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-200 bg-white px-5 text-sm font-bold text-rose-800 hover:border-rose-400"
      >
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        بلّغ عن مشكلة
      </button>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        send.run({ sessionId, category, severity: urgent || safety ? 'urgent' : 'normal', description });
      }}
    >
      <p className="text-sm font-medium text-slate-600">
        البلاغ بيوصل للإدارة بس — مش للطرف التاني في الجلسة.
      </p>
      <Field label="نوع المشكلة" required hint={hint} error={fieldError('category')}>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">اختار…</option>
          {INCIDENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="إيه اللي حصل؟" required error={fieldError('description')}>
        <TextArea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {!safety && (
        <Checkbox
          id={`incident-urgent-${sessionId}`}
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
          label="عاجل — فيه خطر دلوقتي أو الموقف محتاج تدخّل فوري"
        />
      )}
      {safety && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">
          بلاغات سلامة الطفل بتتعامل كعاجلة دايمًا. لو فيه خطر مباشر على حياة حد، اتصل بالطوارئ الأول.
        </p>
      )}
      {!send.errorField && <FormError message={send.error} />}
      <div className="flex gap-2">
        <BusyButton type="submit" busy={send.pending} pendingLabel="جارٍ الإرسال…">
          ابعت البلاغ للإدارة
        </BusyButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
