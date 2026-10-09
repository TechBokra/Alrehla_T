'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Trash2, Upload, X, Star, EyeOff } from 'lucide-react';
import type { SubscriptionTier } from '@/types';
import { saveBoxPlan, deleteBoxPlan, type BoxPlanInput } from '@/actions/box-plans';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { uploadImage } from '@/lib/upload-client';
import { LibraryPicker } from '@/components/dashboard/LibraryPicker';
import { formatPrice } from '@/lib/utils';
import { Field, TextInput, TextArea, Select, Checkbox, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

/**
 * أكشنز الباقات بقت **بترجّع** `{ ok:false, error }` بدل ما ترمي — فرسالة
 * الفشل بتيجي في `result.error`. الـcatch فاضل لانقطاع النت ولرفع الصورة
 * (اللي لسه بيرمي)، وNext بيمسح نص الاستثناء في الإنتاج — فبنعرض الرسالة
 * لو عربية، وإلا رسالة بديلة واضحة.
 */
const messageOf = (err: unknown, fallback: string) => {
  const raw = err instanceof Error ? err.message.trim() : '';
  return /[\u0600-\u06FF]/.test(raw) ? raw : fallback;
};

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
  addonDiscountPercent: 0,
  freeAddonId: '',
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
  addonDiscountPercent: t.addonDiscountPercent ?? 0,
  freeAddonId: t.freeAddonId ?? '',
});

/** الإضافات المتاحة لاختيار «الإضافة المجانية» (ملف 140). */
const AddonsContext = React.createContext<{ id: string; name: string }[]>([]);

export function BoxPlansClient({
  plans,
  addons = [],
}: {
  plans: SubscriptionTier[];
  addons?: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <AddonsContext.Provider value={addons}>
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
    </AddonsContext.Provider>
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
  // `busy` بيقفل الزرارين؛ ده بس عشان «جارٍ الحذف…» تظهر على زرار الحذف لوحده.
  const [deleting, setDeleting] = useState(false);
  const addons = React.useContext(AddonsContext);

  const set = <K extends keyof BoxPlanInput>(key: K, value: BoxPlanInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await saveBoxPlan(planId, {
        ...form,
        features: featuresText.split('\n').map((l) => l.trim()).filter(Boolean),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(messageOf(err, 'تعذّر حفظ الباقة — الاتصال بالخادم — اتأكد من النت وجرّب تاني.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setDeleting(true);
    setError('');
    try {
      const result = await deleteBoxPlan(planId!);
      if (!result.ok) {
        setError(result.error);
        setConfirmDelete(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(messageOf(err, 'تعذّر الحذف — الاتصال بالخادم — اتأكد من النت وجرّب تاني.'));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
      setDeleting(false);
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
      setError(messageOf(err, 'تعذّر رفع الصورة'));
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

      <FormError message={error} className="mb-4" />

      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-700">صورة الباقة</p>
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
            {uploading ? 'جارٍ الرفع…' : form.imageUrl ? 'تغيير' : 'رفع صورة'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
          </label>
          <div className="flex justify-center">
            <LibraryPicker onPick={(url) => set('imageUrl', url)} disabled={uploading} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* النجمة هنا علامة بس — الحفظ أصلًا مقفول من غير اسم. */}
          <Field label="اسم الباقة" required>
            <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="المدة بالأشهر" help="عدد الصناديق — صندوق كل شهر." required>
            <TextInput
              type="number"
              min={1}
              value={form.durationMonths}
              onChange={(e) => set('durationMonths', Number(e.target.value))}
            />
          </Field>
          <Field label="السعر الإجمالي (ج.م)" help="اللي العميل بيدفعه مرة واحدة للمدة كلها، وبيظهر له «إجمالي الدفع»." required>
            <TextInput
              type="number"
              min={0}
              value={form.priceTotal}
              onChange={(e) => set('priceTotal', Number(e.target.value))}
            />
          </Field>
          <Field
            label="السعر الشهري المعروض (ج.م)"
            required
            hint={
              form.durationMonths > 0
                ? `الإجمالي ÷ المدة = ${formatPrice(Math.round(effectiveMonthly))}`
                : undefined
            }
          >
            <TextInput
              type="number"
              min={0}
              value={form.priceMonthly}
              onChange={(e) => set('priceMonthly', Number(e.target.value))}
            />
          </Field>
          <Field label="ملاحظة التوفير" hint="مثال: وفّر ٦٠٠ ج.م">
            <TextInput value={form.savingsNote} onChange={(e) => set('savingsNote', e.target.value)} />
          </Field>
          <Field label="خصم المشترك على الإضافات ٪" hint="على أي إضافة يطلبها طول مدة اشتراكه — ٠ = مفيش. من ٠ لـ٩٠.">
            <TextInput
              type="number"
              min={0}
              max={90}
              value={form.addonDiscountPercent}
              onChange={(e) => set('addonDiscountPercent', Number(e.target.value))}
            />
          </Field>
          <Field label="إضافة مجانية في كل صندوق" hint="بتظهر للإدارة في كل شهر من شهور الاشتراك">
            <Select value={form.freeAddonId} onChange={(e) => set('freeAddonId', e.target.value)}>
              <option value="">— من غير —</option>
              {addons.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="ترتيب العرض" hint="الأصغر يظهر أولًا">
            <TextInput
              type="number"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
            />
          </Field>
          <Field label="وصف مختصر" className="sm:col-span-2">
            <TextArea
              rows={2}
              className="resize-y"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field
            label="مزايا الباقة"
            hint="ميزة في كل سطر — دي اللي بتفرّق الباقة عن غيرها"
            className="sm:col-span-2"
          >
            <TextArea
              rows={4}
              className="resize-y"
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

      <div className="mt-5 flex flex-wrap items-start gap-6 border-t border-slate-100 pt-5">
        <Checkbox
          label="الأكثر اختيارًا"
          hint="باقة واحدة فقط"
          checked={form.isHighlighted}
          onChange={(e) => set('isHighlighted', e.target.checked)}
        />
        <Checkbox
          label="ظاهرة للعملاء"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        {planId ? (
          confirmDelete ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-red-700">حذف نهائي؟</span>
              <BusyButton
                busy={deleting}
                disabled={busy}
                variant="danger"
                pendingLabel="جارٍ الحذف…"
                onClick={remove}
              >
                نعم، احذف
              </BusyButton>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="font-bold text-slate-500 disabled:opacity-50"
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
          {saved && (
            <span role="status" className="text-sm font-bold text-emerald-700">
              تم الحفظ
            </span>
          )}
          <BusyButton busy={busy && !deleting} onClick={save} disabled={busy || !form.name.trim()}>
            {planId ? 'حفظ' : 'إضافة'}
          </BusyButton>
        </div>
      </div>
    </div>
  );
}
