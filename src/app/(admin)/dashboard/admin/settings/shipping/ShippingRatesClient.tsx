'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Check, X, Search, TrendingUp } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { ShippingRateRow } from '@/data/domains/orders';
import {
  upsertShippingRate,
  deleteShippingRate,
  adjustShippingRatesByGovernorate,
} from '@/actions/shipping';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

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

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
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
      })
    );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pr-9`}
            placeholder="ابحث بالمحافظة أو المنطقة…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600"
        >
          <Plus className="h-4 w-4" /> إضافة منطقة
        </button>
      </div>

      {draft && !draft.id && (
        <RateForm
          value={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={() => save(draft)}
          busy={busy}
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
              onClick={() => setBulkGov(bulkGov === governorate ? null : governorate)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <TrendingUp className="h-3.5 w-3.5" /> تعديل كل المحافظة
            </button>
          </div>

          {bulkGov === governorate && (
            <div className="mb-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <label className="text-xs font-bold text-amber-900">
                زيادة أو خصم على كل مناطق {governorate} (بالجنيه — اكتب رقمًا سالبًا للخصم)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className={inputClass}
                  value={bulkDelta}
                  onChange={(e) => setBulkDelta(e.target.value)}
                  placeholder="مثال: 10 أو -5"
                />
                <button
                  type="button"
                  disabled={busy || !bulkDelta}
                  onClick={() =>
                    run(() => adjustShippingRatesByGovernorate(governorate, Number(bulkDelta)))
                  }
                  className="shrink-0 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  تطبيق
                </button>
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
                  onCancel={() => setDraft(null)}
                  onSave={() => save(draft)}
                  busy={busy}
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
                      onClick={() =>
                        setDraft({
                          id: rate.id,
                          governorate: rate.governorate,
                          city: rate.city,
                          fee: String(rate.fee),
                          isActive: rate.isActive,
                        })
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => deleteShippingRate(rate.id))}
                      className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
}: {
  value: Draft;
  onChange: (v: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">المحافظة</label>
          <input
            className={inputClass}
            value={value.governorate}
            onChange={(e) => onChange({ ...value, governorate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">المنطقة / المدينة</label>
          <input
            className={inputClass}
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">السعر (ج.م)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.fee}
            onChange={(e) => onChange({ ...value, fee: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded"
          checked={value.isActive}
          onChange={(e) => onChange({ ...value, isActive: e.target.checked })}
        />
        مفعّلة (تظهر للعملاء في شاشة الدفع)
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> إلغاء
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
