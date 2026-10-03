'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
import { ImageField } from '@/components/dashboard/ImageField';
import { GalleryField } from '@/components/dashboard/GalleryField';
import { optimizedImageUrl } from '@/lib/cloudinary';

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
  coverImageUrl: '',
  galleryImageUrls: [],
  longDescription: '',
  deliverablesText: '',
  requirements: '',
  deliveryDays: null,
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

function Field({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? 'md:col-span-2' : ''}`}>
      <label className="text-xs font-bold text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * نموذج الخدمة — بقسمين: «الكارت» (اللي بيظهر في صفحة الخدمات) و«صفحة
 * الخدمة» (ملف 09: الصورة والنماذج والوصف الكامل و«هتاخد إيه»…).
 */
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
  const set = (patch: Partial<ServiceInput>) => setValue((v) => ({ ...v, ...patch }));

  return (
    <div className="space-y-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-800">الكارت في صفحة الخدمات</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم الخدمة">
            <input
              className={inputClass}
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="مثال: مراجعة نص"
            />
          </Field>
          <Field label="التصنيف" hint="الخدمات بتتجمّع بيه، وبيظهر كزرار فلتر فوق الصفحة.">
            <input
              className={inputClass}
              value={value.category}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="مثال: مراجعات"
            />
          </Field>
          <Field label="السعر (ج.م)">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={value.price}
              onChange={(e) => set({ price: Number(e.target.value) })}
            />
          </Field>
          <Field label="نوع السعر">
            <select
              className={inputClass}
              value={value.priceType}
              onChange={(e) => set({ priceType: e.target.value as ServiceInput['priceType'] })}
            >
              <option value="fixed">سعر ثابت</option>
              <option value="starts_from">يبدأ من (حسب المدرب)</option>
            </select>
          </Field>
          <Field label="مدة التسليم (أيام)" hint="بتظهر «التسليم خلال ٧ أيام». فاضي = مابتظهرش.">
            <input
              type="number"
              min={1}
              max={90}
              className={inputClass}
              value={value.deliveryDays ?? ''}
              onChange={(e) =>
                set({ deliveryDays: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="ترتيب العرض">
            <input
              type="number"
              className={inputClass}
              value={value.sortOrder ?? ''}
              onChange={(e) =>
                set({ sortOrder: e.target.value === '' ? null : Number(e.target.value) })
              }
              placeholder="اتركه فارغًا للترتيب التلقائي"
            />
          </Field>
          <Field label="الوصف القصير" hint="سطرين في الكارت — لحد 300 حرف." wide>
            <textarea
              rows={2}
              maxLength={300}
              className={`${inputClass} resize-none`}
              value={value.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <ImageField
              name="coverImageUrl"
              label="صورة الخدمة"
              folder="alrehla/services"
              value={value.coverImageUrl}
              onChange={(url) => set({ coverImageUrl: url })}
              aspect="wide"
              library
              hint="عرضية (4:3 أو 16:9) — بتظهر في الكارت وأول صفحة الخدمة."
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-amber-200 pt-5">
        <h3 className="text-sm font-black text-slate-800">صفحة الخدمة</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="عن الخدمة" hint="الوصف الكامل — السطور الجديدة بتتحترم." wide>
            <textarea
              rows={6}
              maxLength={5000}
              className={`${inputClass} resize-y`}
              value={value.longDescription}
              onChange={(e) => set({ longDescription: e.target.value })}
            />
          </Field>
          <Field label="هتاخد إيه" hint="سطر لكل نقطة — لحد 8.">
            <textarea
              rows={5}
              className={`${inputClass} resize-y`}
              value={value.deliverablesText}
              onChange={(e) => set({ deliverablesText: e.target.value })}
              placeholder={'نسخة مراجَعة من النص\nملاحظات مكتوبة على كل فقرة\nجلسة 15 دقيقة لشرح الملاحظات'}
            />
          </Field>
          <Field label="محتاجين منك إيه" hint="بيظهر في صفحة الخدمة وفوق خانة «تفاصيل طلبك».">
            <textarea
              rows={5}
              maxLength={1500}
              className={`${inputClass} resize-y`}
              value={value.requirements}
              onChange={(e) => set({ requirements: e.target.value })}
              placeholder="النص اللي عايز تراجعه، وسنّ الكاتب، وأي ملاحظة مهمة."
            />
          </Field>
          <div className="md:col-span-2">
            <GalleryField
              name="galleryImageUrls"
              folder="alrehla/services"
              value={value.galleryImageUrls}
              onChange={(urls) => set({ galleryImageUrls: urls })}
              label="نماذج من شغل قبل كده"
              hint="صفحات، أغلفة، لقطات…"
              library
            />
          </div>
        </div>
      </section>

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
    coverImageUrl: s.coverImageUrl ?? '',
    galleryImageUrls: s.galleryImageUrls ?? [],
    longDescription: s.longDescription ?? '',
    deliverablesText: (s.deliverables ?? []).join('\n'),
    requirements: s.requirements ?? '',
    deliveryDays: s.deliveryDays ?? null,
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
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {service.coverImageUrl ? (
                  <Image
                    src={optimizedImageUrl(service.coverImageUrl, 200)}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">
                    مفيش صورة
                  </span>
                )}
              </div>
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
