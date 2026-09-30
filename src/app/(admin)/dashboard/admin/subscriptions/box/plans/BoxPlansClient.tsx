'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Trash2, Upload, X, Star, EyeOff } from 'lucide-react';
import type { SubscriptionTier } from '@/types';
import { saveBoxPlan, deleteBoxPlan, type BoxPlanInput } from '@/actions/box-plans';
import { uploadImage, optimizedImageUrl } from '@/lib/cloudinary';
import { formatPrice } from '@/lib/utils';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500';

const EMPTY: BoxPlanInput = {
  name: '',
  priceTotal: 0,
  priceMonthly: 0,
  durationMonths: 1,
  savingsNote: '',
  description: '',
  imageUrl: '',
  features: [],
  isHighlighted: false,
  isActive: true,
  sortOrder: 0,
};

const toInput = (t: SubscriptionTier): BoxPlanInput => ({
  name: t.name,
  priceTotal: t.priceTotal,
  priceMonthly: t.priceMonthly,
  durationMonths: t.durationMonths,
  savingsNote: t.savingsNote ?? '',
  description: t.description ?? '',
  imageUrl: t.imageUrl ?? '',
  features: t.features ?? [],
  isHighlighted: t.isHighlighted,
  isActive: t.isActive,
  sortOrder: t.sortOrder,
});

export function BoxPlansClient({ plans }: { plans: SubscriptionTier[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
        الباقات دي هي اللي بتظهر في صفحة «صندوق الرحلة». الصورة والمزايا هما اللي
        بيفرّقوا باقة عن التانية للعميل — من غيرهم بيبقى الفرق سعر ومدة بس.
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800"
        >
          {adding ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {adding ? 'إغلاق' : 'باقة جديدة'}
        </button>
      </div>

      {adding && (
        <PlanForm
          initial={EMPTY}
          planId={null}
          onDone={() => setAdding(false)}
          title="باقة جديدة"
        />
      )}

      {plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center font-medium text-slate-500">
          لا توجد باقات. صفحة «صندوق الرحلة» بتفضل فاضية لحد ما تضيف أول باقة.
        </div>
      ) : (
        plans.map((plan) => (
          <PlanForm
            key={plan.id}
            planId={plan.id}
            initial={toInput(plan)}
            title={plan.name}
            badge={
              <span className="flex items-center gap-2">
                {plan.isHighlighted && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                    <Star className="h-3 w-3" /> الأكثر اختيارًا
                  </span>
                )}
                {!plan.isActive && (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    <EyeOff className="h-3 w-3" /> مخفية
                  </span>
                )}
              </span>
            }
          />
        ))
      )}
    </div>
  );
}

function PlanForm({
  planId,
  initial,
  title,
  badge,
  onDone,
}: {
  planId: string | null;
  initial: BoxPlanInput;
  title: string;
  badge?: React.ReactNode;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BoxPlanInput>(initial);
  const [featuresText, setFeaturesText] = useState(initial.features.join('\n'));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof BoxPlanInput>(key: K, value: BoxPlanInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await saveBoxPlan(planId, {
        ...form,
        features: featuresText.split('\n').map((l) => l.trim()).filter(Boolean),
      });
      setSaved(true);
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteBoxPlan(planId!);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحذف');
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadImage(file, 'alrehla/box-plans');
      set('imageUrl', uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  // مؤشر فوري للسعر الشهري الفعلي — بيكشف خطأ الإدخال قبل الحفظ.
  const effectiveMonthly =
    form.durationMonths > 0 ? form.priceTotal / form.durationMonths : 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-800">{title}</h3>
        {badge}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">صورة الباقة</label>
          <div className="relative h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {form.imageUrl ? (
              <Image
                src={optimizedImageUrl(form.imageUrl, 400)}
                alt={form.name || 'الباقة'}
                fill
                sizes="180px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                بدون صورة
              </div>
            )}
          </div>
          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
            <Upload className="h-4 w-4" />
            {uploading ? 'جارٍ…' : form.imageUrl ? 'تغيير' : 'رفع صورة'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الباقة">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="المدة بالأشهر">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.durationMonths}
              onChange={(e) => set('durationMonths', Number(e.target.value))}
            />
          </Field>
          <Field label="السعر الإجمالي">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.priceTotal}
              onChange={(e) => set('priceTotal', Number(e.target.value))}
            />
          </Field>
          <Field
            label="السعر الشهري المعروض"
            hint={
              form.durationMonths > 0
                ? `الإجمالي ÷ المدة = ${formatPrice(Math.round(effectiveMonthly))}`
                : undefined
            }
          >
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.priceMonthly}
              onChange={(e) => set('priceMonthly', Number(e.target.value))}
            />
          </Field>
          <Field label="ملاحظة التوفير" hint="مثال: وفّر ٦٠٠ ج.م">
            <input
              className={inputClass}
              value={form.savingsNote}
              onChange={(e) => set('savingsNote', e.target.value)}
            />
          </Field>
          <Field label="ترتيب العرض" hint="الأصغر يظهر أولًا">
            <input
              type="number"
              className={inputClass}
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
            />
          </Field>
          <Field label="وصف مختصر" className="sm:col-span-2">
            <textarea
              rows={2}
              className={`${inputClass} resize-y`}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field
            label="مزايا الباقة"
            hint="ميزة في كل سطر — دي اللي بتفرّق الباقة عن غيرها"
            className="sm:col-span-2"
          >
            <textarea
              rows={4}
              className={`${inputClass} resize-y`}
              placeholder={'كتاب مخصص كل شهر\nأنشطة ورقية\nشحن مجاني'}
              value={featuresText}
              onChange={(e) => {
                setFeaturesText(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-5">
        <Toggle
          label="الأكثر اختيارًا"
          hint="باقة واحدة فقط"
          checked={form.isHighlighted}
          onChange={(v) => set('isHighlighted', v)}
        />
        <Toggle
          label="ظاهرة للعملاء"
          checked={form.isActive}
          onChange={(v) => set('isActive', v)}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        {planId ? (
          confirmDelete ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-red-700">حذف نهائي؟</span>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                نعم، احذف
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="font-bold text-slate-500"
              >
                تراجع
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" /> حذف
            </button>
          )
        ) : (
          <span />
        )}

        <div className="flex items-center gap-4">
          {saved && <span className="text-sm font-bold text-emerald-700">تم الحفظ</span>}
          <button
            type="button"
            onClick={save}
            disabled={busy || !form.name.trim()}
            className="rounded-xl bg-slate-900 px-8 py-2.5 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'جارٍ…' : planId ? 'حفظ' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-sm font-bold text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
      />
      <span className="text-sm font-bold text-slate-700">{label}</span>
      {hint && <span className="text-xs font-medium text-slate-400">({hint})</span>}
    </label>
  );
}
