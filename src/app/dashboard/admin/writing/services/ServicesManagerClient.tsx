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
  type StandaloneServiceResult,
} from '@/actions/standalone-services';
import { ImageField } from '@/components/dashboard/ImageField';
import { GalleryField } from '@/components/dashboard/GalleryField';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { BusyButton, Checkbox, Field, Select, TextArea, TextInput } from '@/components/forms/Form';
import { FILE_KINDS, FILE_MAX_MB_LIMIT, type FileKind } from '@/lib/private-files';
import { FormError } from '@/components/ui/FormError';

interface Props {
  services: CreativeService[];
  /** رقم الخدمة ← عدد المقدّمين اللي العميل يقدر يطلب منهم. */
  providerCounts?: Record<string, number>;
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
  allowsFiles: false,
  fileMaxMb: FILE_MAX_MB_LIMIT,
  fileKinds: ['pdf', 'word', 'image'],
};

/**
 * نموذج الخدمة — بقسمين: «الكارت» (اللي بيظهر في صفحة الخدمات) و«صفحة
 * الخدمة» (ملف 09: الصورة والنماذج والوصف الكامل و«هتاخد إيه»…).
 */
function ServiceForm({
  initial,
  onSave,
  onCancel,
  busy,
  error,
}: {
  initial: ServiceInput;
  onSave: (v: ServiceInput) => void;
  onCancel: () => void;
  busy: boolean;
  /** خطأ الحفظ — بيتعرض جوّه النموذج نفسه مش فوق الصفحة. */
  error: string;
}) {
  const [value, setValue] = useState<ServiceInput>(initial);
  const set = (patch: Partial<ServiceInput>) => setValue((v) => ({ ...v, ...patch }));

  return (
    <div className="space-y-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      {/* الخطأ هنا جوّه النموذج: لو بتعدّل خدمة تحت في القايمة، رسالة
          فوق الصفحة كانت بتبقى برّه الشاشة والزرار يبان كأنه ما عملش حاجة. */}
      <FormError message={error} />

      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-800">الكارت في صفحة الخدمات</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم الخدمة" required>
            <TextInput
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="مثال: مراجعة نص"
            />
          </Field>
          <Field label="التصنيف" hint="الخدمات بتتجمّع بيه، وبيظهر كزرار فلتر فوق الصفحة.">
            <TextInput
              value={value.category}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="مثال: مراجعات"
            />
          </Field>
          <Field label="السعر (ج.م)" required>
            <TextInput
              type="number"
              min={0}
              value={value.price}
              onChange={(e) => set({ price: Number(e.target.value) })}
            />
          </Field>
          <Field label="نوع السعر" help="سعر ثابت: الكارت بيكتب السعر زي ما هو. يبدأ من: بيتكتب «يبدأ من» قبل السعر — استخدمه لما السعر بيختلف حسب المدرب أو حجم الشغل.">
            <Select
              value={value.priceType}
              onChange={(e) => set({ priceType: e.target.value as ServiceInput['priceType'] })}
            >
              <option value="fixed">سعر ثابت</option>
              <option value="starts_from">يبدأ من (حسب المدرب)</option>
            </Select>
          </Field>
          <Field label="مدة التسليم (أيام)" hint="بتظهر «التسليم خلال ٧ أيام». فاضي = مابتظهرش.">
            <TextInput
              type="number"
              min={1}
              max={90}
              value={value.deliveryDays ?? ''}
              onChange={(e) =>
                set({ deliveryDays: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="ترتيب العرض" help="الرقم الأصغر بيظهر الأول في صفحة الخدمات. اللي من غير رقم بييجي في الآخر.">
            <TextInput
              type="number"
              value={value.sortOrder ?? ''}
              onChange={(e) =>
                set({ sortOrder: e.target.value === '' ? null : Number(e.target.value) })
              }
              placeholder="اتركه فارغًا للترتيب التلقائي"
            />
          </Field>
          <Field label="الوصف القصير" hint="سطرين في الكارت — لحد 300 حرف." className="md:col-span-2">
            <TextArea
              rows={2}
              maxLength={300}
              className="resize-none"
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
          <Field label="عن الخدمة" hint="الوصف الكامل — السطور الجديدة بتتحترم." className="md:col-span-2">
            <TextArea
              rows={6}
              maxLength={5000}
              className="resize-y"
              value={value.longDescription}
              onChange={(e) => set({ longDescription: e.target.value })}
            />
          </Field>
          <Field label="هتاخد إيه" hint="سطر لكل نقطة — لحد 8.">
            <TextArea
              rows={5}
              className="resize-y"
              value={value.deliverablesText}
              onChange={(e) => set({ deliverablesText: e.target.value })}
              placeholder={'نسخة مراجَعة من النص\nملاحظات مكتوبة على كل فقرة\nجلسة 15 دقيقة لشرح الملاحظات'}
            />
          </Field>
          <Field label="محتاجين منك إيه" hint="بيظهر في صفحة الخدمة وفوق خانة «تفاصيل طلبك».">
            <TextArea
              rows={5}
              maxLength={1500}
              className="resize-y"
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

      {/* ── ملف 20: رفع ملفات على الطلب ─────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-700">الملفات على الطلب</h3>
        <Checkbox
          label="تسمح برفع ملفات"
          hint="العميل يبعت ملفه (قصة، واجب…) ومقدّم الخدمة يسلّم ملف. الملفات مخفية — مابيشوفهاش غير أطراف الطلب والإدارة، وبتتمسح بعد المدة اللي في الإعدادات العامة."
          checked={value.allowsFiles === true}
          onChange={(e) => set({ allowsFiles: e.target.checked })}
        />
        {value.allowsFiles && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="أقصى حجم للملف (ميجا)" hint={`من 1 لـ ${FILE_MAX_MB_LIMIT} — حد Cloudinary الحالي.`}>
              <TextInput
                type="number"
                min={1}
                max={FILE_MAX_MB_LIMIT}
                dir="ltr"
                className="text-left"
                value={value.fileMaxMb ?? FILE_MAX_MB_LIMIT}
                onChange={(e) => set({ fileMaxMb: Number(e.target.value) })}
              />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-slate-700">الأنواع المسموحة</legend>
              <div className="flex flex-wrap gap-4">
                {FILE_KINDS.map(({ kind, label }) => {
                  const kinds: FileKind[] = value.fileKinds ?? [];
                  return (
                    <Checkbox
                      key={kind}
                      label={label}
                      checked={kinds.includes(kind)}
                      onChange={(e) =>
                        set({
                          fileKinds: e.target.checked
                            ? [...kinds, kind]
                            : kinds.filter((k) => k !== kind),
                        })
                      }
                    />
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2">
        {/* الإلغاء مش بيحفظ — فـ`busy` بيقفله بس من غير «جارٍ الحفظ…». */}
        <BusyButton variant="secondary" busy={false} disabled={busy} onClick={onCancel}>
          <X className="h-4 w-4" /> إلغاء
        </BusyButton>
        <BusyButton busy={busy} onClick={() => onSave(value)}>
          <Check className="h-4 w-4" /> حفظ
        </BusyButton>
      </div>
    </div>
  );
}

export function ServicesManagerClient({ services, providerCounts = {} }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // الأكشنز بقت **بترجّع** `{ ok:false, error }` بدل ما ترمي (Next بيخفي
  // رسالة الخطأ المرمي في الإنتاج). الـcatch فاضل بس لانقطاع النت.
  const run = async (fn: () => Promise<StandaloneServiceResult>) => {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAdding(false);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      // رسالة الاستثناء في الإنتاج إنجليزي عامة — فبنعرض رسالة عربية ثابتة.
      console.error(err);
      setError('تعذّر الاتصال بالخادم — اتأكد من النت وجرّب تاني.');
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
    allowsFiles: s.allowsFiles === true,
    fileMaxMb: s.fileMaxMb ?? FILE_MAX_MB_LIMIT,
    fileKinds: s.fileKinds ?? ['pdf', 'word', 'image'],
  });

  return (
    <div className="space-y-6">
      {/* لو فيه نموذج مفتوح الخطأ بيتعرض جوّاه؛ هنا بس لخطأ الإيقاف/التفعيل. */}
      {!adding && editingId === null && <FormError message={error} />}

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
          error={error}
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
              error={error}
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
                <div className="flex flex-wrap items-center gap-2">
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
                  {service.isActive && !providerCounts[service.id] && (
                    <a
                      href="/dashboard/admin/providers"
                      className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 hover:underline"
                    >
                      مفيش مقدّم معتمد — بتظهر «قريبًا»
                    </a>
                  )}
                  {service.isActive && (providerCounts[service.id] ?? 0) > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      بتتطلب · {(providerCounts[service.id] ?? 0).toLocaleString('ar-EG')} مقدّم
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
