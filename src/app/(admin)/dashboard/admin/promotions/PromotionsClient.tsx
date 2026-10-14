'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import {
  discountedPrice,
  isoToCairoLocal,
  promotionState,
  PROMOTION_STATE_LABELS,
  PROMOTION_TARGETS,
  PROMOTION_TARGET_LABELS,
  type Promotion,
  type PromotionState,
  type PromotionTarget,
} from '@/lib/promotions';
import type { PromotionTargetOption } from '@/data/domains/(admin)/promotions/queries';
import {
  createPromotion,
  setPromotionActive,
  updatePromotion,
  type PromotionResult,
} from '@/actions/promotions';
import { Field, TextInput, Select, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

const STATE_STYLES: Record<PromotionState, string> = {
  live: 'bg-emerald-100 text-emerald-800',
  upcoming: 'bg-blue-100 text-blue-800',
  ended: 'bg-slate-200 text-slate-700',
  paused: 'bg-amber-100 text-amber-900',
};

const DATE_FORMAT = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Cairo',
});

type FormState = {
  id: string | null;
  targetType: PromotionTarget;
  targetId: string;
  kind: 'percent' | 'sale_price';
  value: string;
  label: string;
  startsAtLocal: string;
  endsAtLocal: string;
};

function emptyForm(): FormState {
  return {
    id: null,
    targetType: 'product_printed',
    targetId: '',
    kind: 'percent',
    value: '',
    label: '',
    startsAtLocal: '',
    endsAtLocal: '',
  };
}

export function PromotionsClient({
  promotions,
  targets,
  nowIso,
}: {
  promotions: Promotion[];
  targets: Record<PromotionTarget, PromotionTargetOption[]>;
  /** وقت الخادم وقت بناء الصفحة — لحالات العروض (الصفحة force-dynamic). */
  nowIso: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const nameOf = (type: PromotionTarget, id: string) =>
    targets[type].find((t) => t.id === id)?.name ?? `(محذوف: ${id})`;

  const selected = targets[form.targetType].find((t) => t.id === form.targetId);
  const numericValue = Number(form.value);
  const previewPrice =
    selected && Number.isFinite(numericValue) && numericValue > 0
      ? discountedPrice({ kind: form.kind, value: numericValue }, selected.price)
      : null;

  const rows = useMemo(() => {
    const now = new Date(nowIso);
    return promotions.map((p) => ({ p, state: promotionState(p, now) }));
  }, [promotions, nowIso]);

  const run = async (key: string, fn: () => Promise<PromotionResult>): Promise<boolean> => {
    setBusyKey(key);
    setError('');
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error || 'تعذّر الحفظ');
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const submit = async () => {
    const payload = {
      targetType: form.targetType,
      targetId: form.targetId,
      kind: form.kind,
      value: numericValue,
      label: form.label,
      startsAtLocal: form.startsAtLocal,
      endsAtLocal: form.endsAtLocal,
    };
    const ok = await run('form', () =>
      form.id ? updatePromotion(form.id, payload) : createPromotion(payload),
    );
    if (ok) setForm(emptyForm());
  };

  const edit = (p: Promotion) =>
    setForm({
      id: p.id,
      targetType: p.targetType,
      targetId: p.targetId,
      kind: p.kind,
      value: String(p.value),
      label: p.label ?? '',
      startsAtLocal: isoToCairoLocal(p.startsAt),
      endsAtLocal: isoToCairoLocal(p.endsAt),
    });

  return (
    <div className="space-y-8">
      {error && <FormError message={error} />}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-black text-slate-800">{form.id ? 'تعديل العرض' : 'عرض جديد'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="ينطبق على">
            <Select
              value={form.targetType}
              onChange={(e) =>
                setForm({ ...form, targetType: e.target.value as PromotionTarget, targetId: '' })
              }
            >
              {PROMOTION_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {PROMOTION_TARGET_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="العنصر">
            <Select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
              <option value="">اختر...</option>
              {targets[form.targetType].map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {formatPrice(t.price)}
                  {t.isActive ? '' : ' (موقوف)'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="نوع الخصم">
            <Select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as 'percent' | 'sale_price' })}
            >
              <option value="percent">نسبة مئوية (٪)</option>
              <option value="sale_price">سعر العرض (ج.م)</option>
            </Select>
          </Field>
          <Field
            label={form.kind === 'percent' ? 'النسبة (١ إلى ٩٩)' : 'سعر العرض (ج.م)'}
            hint="رقم صحيح بدون كسور."
          >
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label="يبدأ (بتوقيت القاهرة)">
            <TextInput
              type="datetime-local"
              value={form.startsAtLocal}
              onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value })}
            />
          </Field>
          <Field label="ينتهي (بتوقيت القاهرة)">
            <TextInput
              type="datetime-local"
              value={form.endsAtLocal}
              onChange={(e) => setForm({ ...form, endsAtLocal: e.target.value })}
            />
          </Field>
          <Field label="عنوان على الشارة (اختياري)" hint="مثال: عرض الإطلاق. فاضي = «خصم ٢٥٪».">
            <TextInput
              maxLength={60}
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </Field>
        </div>

        {selected && previewPrice !== null && (
          <p className="text-sm font-bold text-slate-700">
            المعاينة: {formatPrice(selected.price)} ← {formatPrice(Math.min(previewPrice, selected.price))}
            {previewPrice >= selected.price && (
              <span className="mr-2 text-amber-800">(العرض بهذه القيمة لا يخفّض السعر)</span>
            )}
          </p>
        )}

        <div className="flex gap-3">
          <BusyButton type="button" busy={busyKey === 'form'} disabled={busyKey !== null} onClick={submit}>
            {form.id ? 'حفظ التعديل' : 'إضافة العرض'}
          </BusyButton>
          {form.id && (
            <BusyButton type="button" variant="secondary" busy={false} onClick={() => setForm(emptyForm())}>
              إلغاء التعديل
            </BusyButton>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-800">كل العروض</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
            لا توجد عروض بعد.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ p, state }) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">
                    {nameOf(p.targetType, p.targetId)}{' '}
                    <span className="text-xs font-medium text-slate-500">
                      ({PROMOTION_TARGET_LABELS[p.targetType]})
                    </span>
                  </p>
                  <p className="text-sm text-slate-700">
                    {p.kind === 'percent' ? `خصم ${p.value.toLocaleString('ar-EG')}٪` : `سعر العرض ${formatPrice(p.value)}`}
                    {p.label ? ` — ${p.label}` : ''}
                  </p>
                  <p className="text-xs text-slate-600">
                    من {DATE_FORMAT.format(new Date(p.startsAt))} إلى {DATE_FORMAT.format(new Date(p.endsAt))}
                  </p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-black ${STATE_STYLES[state]}`}>
                  {PROMOTION_STATE_LABELS[state]}
                </span>
                <BusyButton type="button" variant="secondary" busy={false} onClick={() => edit(p)}>
                  تعديل
                </BusyButton>
                <BusyButton
                  type="button"
                  variant="secondary"
                  busy={busyKey === p.id}
                  disabled={busyKey !== null}
                  onClick={() => run(p.id, () => setPromotionActive(p.id, !p.isActive))}
                >
                  {p.isActive ? 'إيقاف' : 'تفعيل'}
                </BusyButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
