'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Eye, EyeOff, X, Check } from 'lucide-react';
import { CreativeService } from '@/types';
import { formatPrice } from '@/lib/utils';
import {
  createStandaloneService,
  updateStandaloneService,
  setStandaloneServiceActive,
  type ServiceInput,
} from '@/actions/standalone-services';

interface Props {
  services: CreativeService[];
}

const EMPTY: ServiceInput = {
  name: '',
  price: 0,
  description: '',
  category: '',
  priceType: 'fixed',
  sortOrder: null,
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

function ServiceForm({
  initial,
  onSave,
  onCancel,
  busy,
}: {
  initial: ServiceInput;
  onSave: (v: ServiceInput) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [value, setValue] = useState<ServiceInput>(initial);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">اسم الخدمة</label>
          <input
            className={inputClass}
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
            placeholder="مثال: مراجعة نص"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">السعر (ج.م)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.price}
            onChange={(e) => setValue({ ...value, price: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">التصنيف</label>
          <input
            className={inputClass}
            value={value.category}
            onChange={(e) => setValue({ ...value, category: e.target.value })}
            placeholder="مثال: مراجعات"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">نوع السعر</label>
          <select
            className={inputClass}
            value={value.priceType}
            onChange={(e) =>
              setValue({ ...value, priceType: e.target.value as ServiceInput['priceType'] })
            }
          >
            <option value="fixed">سعر ثابت</option>
            <option value="starts_from">يبدأ من (حسب المدرب)</option>
          </select>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-slate-700">الوصف</label>
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            value={value.description}
            onChange={(e) => setValue({ ...value, description: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">ترتيب العرض</label>
          <input
            type="number"
            className={inputClass}
            value={value.sortOrder ?? ''}
            onChange={(e) =>
              setValue({
                ...value,
                sortOrder: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="اتركه فارغًا للترتيب التلقائي"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> إلغاء
        </button>
        <button
          type="button"
          onClick={() => onSave(value)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}

export function ServicesManagerClient({ services }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setAdding(false);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setBusy(false);
    }
  };

  const toInput = (s: CreativeService): ServiceInput => ({
    name: s.name,
    price: s.price,
    description: s.description ?? '',
    category: s.category ?? '',
    priceType: s.priceType,
    sortOrder: s.sortOrder ?? null,
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600"
        >
          <Plus className="h-4 w-4" /> إضافة خدمة
        </button>
      </div>

      {adding && (
        <ServiceForm
          initial={EMPTY}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={(v) => run(() => createStandaloneService(v))}
        />
      )}

      <div className="space-y-3">
        {services.length === 0 && !adding && (
          <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            لا توجد خدمات بعد.
          </p>
        )}

        {services.map((service) =>
          editingId === service.id ? (
            <ServiceForm
              key={service.id}
              initial={toInput(service)}
              busy={busy}
              onCancel={() => setEditingId(null)}
              onSave={(v) => run(() => updateStandaloneService(service.id, v))}
            />
          ) : (
            <div
              key={service.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-800">{service.name}</h3>
                  {service.category && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                      {service.category}
                    </span>
                  )}
                  {/* الشاشة دي بتعرض الموقوف كمان — لازم يبان من نظرة. */}
                  {!service.isActive && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                      موقوفة — مش ظاهرة للعملاء
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {service.description || '—'}
                </p>
              </div>

              <div className="text-left">
                <p className="text-lg font-black text-slate-800">{formatPrice(service.price)}</p>
                <p className="text-xs font-bold text-slate-400">
                  {service.priceType === 'starts_from' ? 'يبدأ من' : 'سعر ثابت'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setEditingId(service.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" /> تعديل
                </button>
                {/*
                  كان زرار «حذف» بيمسح الخدمة نهائيًا — مخالف لقاعدة
                  «الإيقاف بدل الحذف»، وكان بيترفض أصلًا لو على الخدمة
                  طلبات أو عروض مدربين، فالإدارة تفضل عالقة معاها.
                */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => setStandaloneServiceActive(service.id, !service.isActive))}
                  className={
                    service.isActive
                      ? 'inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50'
                      : 'inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50'
                  }
                >
                  {service.isActive ? (
                    <><EyeOff className="h-4 w-4" /> إيقاف</>
                  ) : (
                    <><Eye className="h-4 w-4" /> إعادة تفعيل</>
                  )}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
