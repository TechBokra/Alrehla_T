'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { saveAddon, setAddonActive } from '@/actions/addons';
import { formatPrice } from '@/lib/utils';
import type { AddonProduct } from '@/types';
import { Field, TextInput, TextArea, Checkbox, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

const UNEXPECTED = 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.';

const EMPTY = {
  id: '',
  name: '',
  description: '',
  price: 0,
  isActive: true,
  sortOrder: 0,
};

export function AddonsClient({ addons }: { addons: AddonProduct[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // الإضافة اللي بيتغيّر تفعيلها دلوقتي — عشان زرارها يتقفل ومايتبعتش مرتين.
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const edit = (addon: AddonProduct) => {
    setForm({
      id: addon.id,
      name: addon.name,
      description: addon.description ?? '',
      price: addon.price,
      isActive: addon.isActive,
      sortOrder: addon.sortOrder,
    });
    setOpen(true);
    setError('');
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    // ⚠️ لو النداء نفسه وقع (شبكة مثلًا) كان `busy` بيفضل شغّال للأبد
    //    والزرار مقفول من غير رسالة. دلوقتي بيرجع ويقول.
    let result: Awaited<ReturnType<typeof saveAddon>>;
    try {
      result = await saveAddon({
        id: form.id || undefined,
        name: form.name,
        description: form.description,
        price: Number(form.price),
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder),
      });
    } catch {
      setError(UNEXPECTED);
      return;
    } finally {
      setBusy(false);
    }

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm(EMPTY);
    setOpen(false);
    router.refresh();
  };

  const toggle = async (addon: AddonProduct) => {
    setTogglingId(addon.id);
    setError('');
    try {
      const result = await setAddonActive(addon.id, !addon.isActive);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(UNEXPECTED);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            setOpen((v) => !v);
            setError('');
          }}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800"
        >
          {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {open ? 'إغلاق' : 'إضافة جديدة'}
        </button>
      </div>

      <FormError message={error} className="mb-4" />

      {open && (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-black text-slate-800">
            {form.id ? 'تعديل إضافة' : 'إضافة جديدة'}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* النجمة علامة بس — الحفظ مقفول أصلًا من غير اسم. */}
            <Field label="الاسم" required>
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="السعر للعميل (ج.م)" required hint="شامل التخصيص باسم الطفل وصورته">
              <TextInput
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
            <Field label="الوصف" className="md:col-span-2">
              <TextArea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="الترتيب في القايمة" hint="الأصغر يظهر أولًا">
              <TextInput
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </Field>
            <Checkbox
              className="md:pt-9"
              label="معروضة للعملاء"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />

            {/* ملف 08 (قرار تامر): **كل الإضافات بتتخصص** باسم الطفل وصورته اللي
                اتكتبوا للقصة — مفيش اختيار هنا ولا «فرق تخصيص»: سعر واحد. */}
            <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 md:col-span-2">
              كل إضافة بتتعمل باسم الطفل وصورته — العميل مابيختارش ده، وبيشوف السعر ده بالظبط.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <BusyButton busy={busy} onClick={submit} disabled={!form.name.trim()}>
              حفظ
            </BusyButton>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {addons.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center font-medium text-slate-500">
            مفيش إضافات لسه. اللي هتضيفه هنا هيظهر للعميل في خطوة الإضافات
            وسعره هيتحسب في القاعدة.
          </p>
        )}

        {addons.map((addon) => (
          <div
            key={addon.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-800">{addon.name}</h3>
                {!addon.isActive && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    موقوفة
                  </span>
                )}
              </div>
              {addon.description && (
                <p className="mt-1 text-sm text-slate-500">{addon.description}</p>
              )}
            </div>

            <div className="text-end">
              <div className="font-black text-slate-800">{formatPrice(addon.price)}</div>
              <div className="mt-0.5 text-xs font-bold text-emerald-700">
                باسم الطفل وصورته
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => edit(addon)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                تعديل
              </button>
              <button
                type="button"
                onClick={() => toggle(addon)}
                disabled={togglingId !== null}
                aria-busy={togglingId === addon.id || undefined}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {togglingId === addon.id ? 'جارٍ…' : addon.isActive ? 'إيقاف' : 'تفعيل'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm font-medium text-slate-500">
        الإيقاف بيشيل الإضافة من قدام العميل ويسيب الطلبات القديمة زي ما هي.
        مفيش حذف عن قصد: الحذف بيكسر طلبات اتعملت فعلًا.
      </p>
    </div>
  );
}
