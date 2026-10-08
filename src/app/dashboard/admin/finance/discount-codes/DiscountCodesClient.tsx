'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Ticket } from 'lucide-react';
import type { DiscountCodeRow } from '@/data/domains/discount-codes';
import { saveDiscountCode, setDiscountCodeActive, type DiscountCodeInput } from '@/actions/discount-codes';
import { DISCOUNT_LINES, DISCOUNT_LINE_LABELS, linesSummary } from '@/lib/discount-codes';
import { Field, TextInput, TextArea, Checkbox, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { StatusBadge } from '@/components/StatusBadge';
import { cairoParts, formatCairo } from '@/lib/timezone';
import { formatPrice } from '@/lib/utils';

const pad = (n: number) => String(n).padStart(2, '0');

/** لحظة مخزّنة ← `YYYY-MM-DD` بتقويم القاهرة (لخانة التاريخ). */
function toDay(iso: string | null): string {
  if (!iso) return '';
  const p = cairoParts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

const EMPTY: DiscountCodeInput = {
  code: '',
  percent: 10,
  lines: [],
  startsOn: '',
  endsOn: '',
  maxUses: '',
  note: '',
  isActive: true,
};

function fromRow(r: DiscountCodeRow): DiscountCodeInput {
  return {
    id: r.id,
    code: r.code,
    percent: r.percent,
    lines: r.lines ?? [],
    startsOn: toDay(r.startsAt),
    endsOn: toDay(r.endsAt),
    maxUses: r.maxUses ? String(r.maxUses) : '',
    note: r.note ?? '',
    isActive: r.isActive,
  };
}

/** الحالة اللي الإدارة محتاجة تشوفها: شغّال، متوقف، لسه، انتهى، خلص عدده. */
function stateOf(r: DiscountCodeRow): { label: string; type: 'success' | 'warning' | 'neutral' | 'danger' } {
  const now = Date.now();
  if (!r.isActive) return { label: 'متوقف', type: 'neutral' };
  if (r.endsAt && new Date(r.endsAt).getTime() <= now) return { label: 'انتهى', type: 'neutral' };
  if (r.maxUses !== null && r.used >= r.maxUses) return { label: 'خلص عدده', type: 'warning' };
  if (r.startsAt && new Date(r.startsAt).getTime() > now) return { label: 'لسه مابدأش', type: 'warning' };
  return { label: 'شغّال', type: 'success' };
}

export function DiscountCodesClient({ codes }: { codes: DiscountCodeRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DiscountCodeInput | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<string | undefined>();
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const save = async () => {
    if (!draft) return;
    setBusy('form');
    setError('');
    setErrorField(undefined);
    const r = await saveDiscountCode(draft);
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      setErrorField(r.field);
      return;
    }
    setDraft(null);
    router.refresh();
  };

  const toggle = async (row: DiscountCodeRow) => {
    setBusy(row.id);
    setRowError(null);
    const r = await setDiscountCodeActive(row.id, !row.isActive);
    setBusy(null);
    if (!r.ok) setRowError({ id: row.id, message: r.error });
    else router.refresh();
  };

  const set = <K extends keyof DiscountCodeInput>(k: K, v: DiscountCodeInput[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  const err = (f: string) => (errorField === f ? error : undefined);

  return (
    <div className="space-y-6">
      {!draft && (
        <button
          type="button"
          onClick={() => {
            setDraft({ ...EMPTY });
            setError('');
            setErrorField(undefined);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md hover:bg-slate-800"
        >
          <Plus className="h-5 w-5" aria-hidden="true" /> كود جديد
        </button>
      )}

      {draft && (
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-black text-slate-800">{draft.id ? `تعديل ${draft.code}` : 'كود جديد'}</h2>
          {error && !errorField && <FormError message={error} />}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="الكود" required hint="حروف إنجليزي وأرقام و- و_ — مثلًا RAMADAN10." error={err('code')}>
              <TextInput
                dir="ltr"
                value={draft.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                maxLength={30}
                className="font-mono"
              />
            </Field>
            <Field label="نسبة الخصم ٪" required hint="من ١ لـ٩٠." error={err('percent')}>
              <TextInput
                type="number"
                min={1}
                max={90}
                value={String(draft.percent)}
                onChange={(e) => set('percent', Number(e.target.value))}
              />
            </Field>
            <Field label="يبدأ من" hint="فاضي = من دلوقتي." error={err('startsOn')}>
              <TextInput type="date" value={draft.startsOn} onChange={(e) => set('startsOn', e.target.value)} />
            </Field>
            <Field label="لحد" hint="آخر اليوم ده. فاضي = من غير نهاية." error={err('endsOn')}>
              <TextInput type="date" value={draft.endsOn} onChange={(e) => set('endsOn', e.target.value)} />
            </Field>
            <Field
              label="عدد الاستخدامات كله"
              hint="فاضي = من غير حد. كل عميل مرة واحدة في كل الأحوال."
              error={err('maxUses')}
            >
              <TextInput
                type="number"
                min={1}
                value={draft.maxUses}
                onChange={(e) => set('maxUses', e.target.value)}
              />
            </Field>
            <Field label="ملاحظة للإدارة" hint="مش بتظهر للعميل." error={err('note')}>
              <TextArea rows={2} value={draft.note} onChange={(e) => set('note', e.target.value)} maxLength={300} />
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-bold text-slate-700">يشتغل على</legend>
            <p className="text-xs font-medium text-slate-500">ماتختارش حاجة = كل المنصة.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DISCOUNT_LINES.map((l) => (
                <Checkbox
                  key={l}
                  label={DISCOUNT_LINE_LABELS[l]}
                  checked={draft.lines.includes(l)}
                  onChange={(e) =>
                    set('lines', e.target.checked ? [...draft.lines, l] : draft.lines.filter((x) => x !== l))
                  }
                />
              ))}
            </div>
          </fieldset>

          <Checkbox
            label="شغّال"
            hint="الكود المتوقف مابيتقبلش — والطلبات اللي خدته قبل كده زي ما هي."
            checked={draft.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6">
            <BusyButton busy={false} variant="secondary" disabled={busy === 'form'} onClick={() => setDraft(null)}>
              إلغاء
            </BusyButton>
            <BusyButton busy={busy === 'form'} onClick={save}>
              حفظ
            </BusyButton>
          </div>
        </section>
      )}

      {codes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <Ticket className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
          <p className="font-bold text-slate-700">مفيش أكواد لسه.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {codes.map((r) => {
            const state = stateOf(r);
            return (
              <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span dir="ltr" className="font-mono text-lg font-black text-slate-900">
                      {r.code}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-800">
                      {r.percent.toLocaleString('ar-EG')}٪
                    </span>
                    <StatusBadge type={state.type} label={state.label} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(fromRow(r));
                        setError('');
                        setErrorField(undefined);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-slate-400"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" /> تعديل
                    </button>
                    <BusyButton
                      busy={busy === r.id}
                      pendingLabel="…"
                      variant="secondary"
                      onClick={() => toggle(r)}
                      className="!min-h-[40px] !px-4 !py-0 text-sm"
                    >
                      {r.isActive ? 'إيقاف' : 'تشغيل'}
                    </BusyButton>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-slate-500">على:</dt>
                    <dd className="font-bold text-slate-800">{linesSummary(r.lines)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate-500">الاستخدام:</dt>
                    <dd className="font-bold text-slate-800">
                      {r.used.toLocaleString('ar-EG')}
                      {r.maxUses !== null ? ` من ${r.maxUses.toLocaleString('ar-EG')}` : ' (من غير حد)'}
                      {r.totalDiscount > 0 && ` · خصم ${formatPrice(r.totalDiscount)}`}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate-500">المدة:</dt>
                    <dd className="font-bold text-slate-800">
                      {r.startsAt ? `من ${formatCairo(r.startsAt, { dateStyle: 'medium' })}` : 'من دلوقتي'}
                      {' — '}
                      {r.endsAt ? `لحد ${formatCairo(r.endsAt, { dateStyle: 'medium' })}` : 'من غير نهاية'}
                    </dd>
                  </div>
                  {r.note && (
                    <div className="flex gap-2">
                      <dt className="text-slate-500">ملاحظة:</dt>
                      <dd className="text-slate-700">{r.note}</dd>
                    </div>
                  )}
                </dl>
                {rowError?.id === r.id && <FormError message={rowError.message} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
