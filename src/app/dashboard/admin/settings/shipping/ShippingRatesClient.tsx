'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Check, X, Search, TrendingUp } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { ShippingRateRow } from '@/data/domains/orders';
import {
  upsertShippingRate,
  setShippingRateActive,
  adjustShippingRatesByGovernorate,
} from '@/actions/shipping';
import { Field, TextInput, Checkbox, BusyButton, fieldClass } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

/**
 * العملية الشغّالة/الأخيرة: فورم المنطقة، أو لوحة تعديل المحافظة، أو غيرهم.
 * الخطأ بيظهر جنب اللي اتداس، و«جارٍ…» على زراره هو بس.
 */
type ErrorAt = 'form' | 'bulk' | 'top';

type Draft = { id?: string; governorate: string; city: string; fee: string; isActive: boolean };

const EMPTY: Draft = { governorate: '', city: '', fee: '', isActive: true };

export function ShippingRatesClient({ rates }: { rates: ShippingRateRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulkGov, setBulkGov] = useState<string | null>(null);
  const [bulkDelta, setBulkDelta] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // ⚠️ قبل كده كل الأخطاء كانت فوق الصفحة — ولو بتعدّل منطقة تحت في
  //    القايمة الرسالة ماكانتش باينة خالص. دلوقتي بتظهر جوّه الفورم نفسه.
  const [errorAt, setErrorAt] = useState<ErrorAt>('top');

  // ⚠️ الأكشنز بقت **بترجّع** `{ ok:false, error }` ولا بترمي (قاعدة
  //    «هـ») — فلازم النتيجة تتقري، وإلا الرفض يعدّي كأنه نجاح.
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, where: ErrorAt = 'top') => {
    setBusy(true);
    setError('');
    setErrorAt(where);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'تعذّر الحفظ');
        return;
      }
      setDraft(null);
      setBulkGov(null);
      setBulkDelta('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const term = query.trim();
    const filtered = term
      ? rates.filter((r) => r.governorate.includes(term) || r.city.includes(term))
      : rates;
    return filtered.reduce<Record<string, ShippingRateRow[]>>((acc, rate) => {
      (acc[rate.governorate] ??= []).push(rate);
      return acc;
    }, {});
  }, [rates, query]);

  const save = (value: Draft) =>
    run(() =>
      upsertShippingRate({
        id: value.id,
        governorate: value.governorate,
        city: value.city,
        fee: Number(value.fee),
        isActive: value.isActive,
      }),
      'form'
    );

  return (
    <div className="space-y-6">
      <FormError message={errorAt === 'top' ? error : ''} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="ابحث بالمحافظة أو المنطقة"
            className={`${fieldClass} pr-9`}
            placeholder="ابحث بالمحافظة أو المنطقة…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft({ ...EMPTY });
            setError('');
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600"
        >
          <Plus className="h-4 w-4" /> إضافة منطقة
        </button>
      </div>

      {draft && !draft.id && (
        <RateForm
          value={draft}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null);
            setError('');
          }}
          onSave={() => save(draft)}
          busy={busy}
          saving={busy && errorAt === 'form'}
          error={errorAt === 'form' ? error : ''}
        />
      )}

      {Object.keys(grouped).length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          لا توجد مناطق مطابقة.
        </p>
      )}

      {Object.entries(grouped).map(([governorate, areas]) => (
        <div key={governorate} className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-black text-slate-800">{governorate}</h3>
              <p className="text-xs font-bold text-slate-400">
                {areas.length} منطقة · من {formatPrice(Math.min(...areas.map((a) => a.fee)))} إلى{' '}
                {formatPrice(Math.max(...areas.map((a) => a.fee)))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setBulkGov(bulkGov === governorate ? null : governorate);
                setError('');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <TrendingUp className="h-3.5 w-3.5" /> تعديل كل المحافظة
            </button>
          </div>

          {bulkGov === governorate && (
            <div className="mb-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <FormError message={errorAt === 'bulk' ? error : ''} />
              <div className="flex flex-wrap items-start gap-2">
                <Field
                  label={`زيادة أو خصم على كل مناطق ${governorate} (ج.م)`}
                  hint="اكتب رقمًا سالبًا للخصم."
                  className="min-w-[200px] flex-1"
                >
                  <TextInput
                    type="number"
                    value={bulkDelta}
                    onChange={(e) => setBulkDelta(e.target.value)}
                    placeholder="مثال: 10 أو -5"
                  />
                </Field>
                <BusyButton
                  busy={busy && errorAt === 'bulk'}
                  pendingLabel="جارٍ التطبيق…"
                  disabled={busy || !bulkDelta}
                  onClick={() =>
                    run(() => adjustShippingRatesByGovernorate(governorate, Number(bulkDelta)), 'bulk')
                  }
                  className="mt-7 shrink-0"
                >
                  تطبيق
                </BusyButton>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {areas.map((rate) =>
              draft?.id === rate.id ? (
                <RateForm
                  key={rate.id}
                  value={draft}
                  onChange={setDraft}
                  onCancel={() => {
                    setDraft(null);
                    setError('');
                  }}
                  onSave={() => save(draft)}
                  busy={busy}
                  saving={busy && errorAt === 'form'}
                  error={errorAt === 'form' ? error : ''}
                />
              ) : (
                <div
                  key={rate.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 ${
                    rate.isActive ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white opacity-60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-800">{rate.city}</span>
                    {!rate.isActive && (
                      <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                        موقوفة
                      </span>
                    )}
                  </div>
                  <span className="font-black text-slate-800">{formatPrice(rate.fee)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: rate.id,
                          governorate: rate.governorate,
                          city: rate.city,
                          fee: String(rate.fee),
                          isActive: rate.isActive,
                        });
                        setError('');
                      }}
                      aria-label={`تعديل ${rate.city}`}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {/* ⚠️ كان «حذف نهائي» بسلة مهملات ومن غير تأكيد. بقى
                        إيقاف/تشغيل — ضغطة غلط بتترجع بضغطة. */}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => setShippingRateActive(rate.id, !rate.isActive))}
                      aria-label={rate.isActive ? `إيقاف ${rate.city}` : `تشغيل ${rate.city}`}
                      className={`rounded-xl border bg-white px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                        rate.isActive
                          ? 'border-red-200 text-red-700 hover:bg-red-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {rate.isActive ? 'إيقاف' : 'تشغيل'}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RateForm({
  value,
  onChange,
  onCancel,
  onSave,
  busy,
  saving,
  error,
}: {
  value: Draft;
  onChange: (v: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  saving: boolean;
  error: string;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <FormError message={error} />
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="المحافظة" required>
          <TextInput
            value={value.governorate}
            onChange={(e) => onChange({ ...value, governorate: e.target.value })}
          />
        </Field>
        <Field label="المنطقة / المدينة" required>
          <TextInput value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} />
        </Field>
        <Field label="السعر (ج.م)" required>
          <TextInput
            type="number"
            min={0}
            value={value.fee}
            onChange={(e) => onChange({ ...value, fee: e.target.value })}
          />
        </Field>
      </div>

      <Checkbox
        label="مفعّلة"
        hint="تظهر للعملاء في شاشة الدفع"
        checked={value.isActive}
        onChange={(e) => onChange({ ...value, isActive: e.target.checked })}
      />

      <div className="flex justify-end gap-2">
        <BusyButton busy={false} variant="secondary" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" /> إلغاء
        </BusyButton>
        <BusyButton busy={saving} disabled={busy} onClick={onSave}>
          <Check className="h-4 w-4" /> حفظ
        </BusyButton>
      </div>
    </div>
  );
}
