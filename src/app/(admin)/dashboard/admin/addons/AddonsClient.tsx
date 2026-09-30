'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { saveAddon, setAddonActive } from '@/actions/addons';
import { formatPrice } from '@/lib/utils';
import type { AddonProduct } from '@/types';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

const EMPTY = {
  id: '',
  name: '',
  description: '',
  price: 0,
  isActive: true,
  sortOrder: 0,
  supportsCustomization: false,
  customizationPrice: 0,
};

export function AddonsClient({ addons }: { addons: AddonProduct[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const edit = (addon: AddonProduct) => {
    setForm({
      id: addon.id,
      name: addon.name,
      description: addon.description ?? '',
      price: addon.price,
      isActive: addon.isActive,
      sortOrder: addon.sortOrder,
      supportsCustomization: addon.supportsCustomization,
      customizationPrice: addon.customizationPrice,
    });
    setOpen(true);
    setError('');
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    const result = await saveAddon({
      id: form.id || undefined,
      name: form.name,
      description: form.description,
      price: Number(form.price),
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
      supportsCustomization: form.supportsCustomization,
      customizationPrice: Number(form.customizationPrice),
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm(EMPTY);
    setOpen(false);
    router.refresh();
  };

  const toggle = async (addon: AddonProduct) => {
    const result = await setAddonActive(addon.id, !addon.isActive);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
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

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {open && (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-black text-slate-800">
            {form.id ? 'تعديل إضافة' : 'إضافة جديدة'}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">الاسم</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">السعر (جنيه)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-bold text-slate-700">الوصف</label>
              <textarea
                className={`${inputClass} h-20`}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">الترتيب في القايمة</label>
              <input
                type="number"
                className={inputClass}
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-3 pt-7">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300"
              />
              <span className="text-sm font-bold text-slate-700">معروضة للعملاء</span>
            </label>

            {/* التخصيص — العميل بيختار «بتخصيص / بدون» في خطوة الإضافات،
                والتخصيص بياخد بيانات الطفل المدخلة في المعالج. */}
            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                checked={form.supportsCustomization}
                onChange={(e) =>
                  setForm({ ...form, supportsCustomization: e.target.checked })
                }
                className="h-5 w-5 rounded border-slate-300"
              />
              <span className="text-sm font-bold text-slate-700">
                تقبل التخصيص باسم الطفل وبياناته
              </span>
            </label>

            {form.supportsCustomization && (
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">
                  فرق سعر التخصيص (جنيه)
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.customizationPrice}
                  onChange={(e) =>
                    setForm({ ...form, customizationPrice: Number(e.target.value) })
                  }
                />
                <p className="text-xs font-medium text-slate-500">
                  بيتضاف على السعر الأساسي لو العميل اختار «بتخصيص». صفر يعني
                  التخصيص مجاني.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !form.name.trim()}
              className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
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
              {addon.supportsCustomization && (
                <div className="mt-0.5 text-xs font-bold text-emerald-700">
                  بتخصيص: {formatPrice(addon.price + addon.customizationPrice)}
                </div>
              )}
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
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                {addon.isActive ? 'إيقاف' : 'تفعيل'}
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
