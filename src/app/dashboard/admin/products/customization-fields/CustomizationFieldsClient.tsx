'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  deleteCustomizationField,
  reorderCustomizationFields,
  saveCustomizationField,
} from '@/actions/customization-fields';
import {
  FIELDS_MAX,
  LABEL_MAX,
  PLACEHOLDER_MAX,
  moveItem,
  type CustomizationField,
} from '@/lib/customization-fields';
import { appliesToSummary, type AppliesToProduct } from '@/lib/applies-to';
import { FormError } from '@/components/ui/FormError';
import { BusyButton, Checkbox, Field, TextInput } from '@/components/forms/Form';
import { AppliesToPicker } from '@/components/admin/AppliesToPicker';

type Draft = {
  id?: string;
  label: string;
  placeholder: string;
  isRequired: boolean;
  isActive: boolean;
  appliesTo: string[] | null;
};

const empty: Draft = { label: '', placeholder: '', isRequired: false, isActive: true, appliesTo: null };

export function CustomizationFieldsClient({
  fields,
  products,
  appliesToReady,
}: {
  fields: CustomizationField[];
  /** للـ«يظهر فين» — المخصص والمكتبة بس. */
  products: AppliesToProduct[];
  /** ملف 12 اتشغّل؟ قبله «كل المنتجات» بس. */
  appliesToReady: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(fields);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // ⚠️ خطأ الحفظ بيظهر جوّه فورم الخانة نفسه — فورم «خانة جديدة» تحت
  //    آخر القايمة، ورسالة فوق الصفحة ماكانتش بتبان. الباقي (ترتيب/مسح) فوق.
  const [errorInForm, setErrorInForm] = useState(false);
  const formError = errorInForm ? error : '';

  // القايمة بتتحدّث من الخادم بعد أي حفظ — بس الأسهم بتتحرك قدامك على طول.
  React.useEffect(() => setRows(fields), [fields]);

  const run = async (
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    inForm = false,
  ) => {
    setBusy(true);
    setError('');
    setErrorInForm(inForm);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const ok = await run(() => saveCustomizationField(draft), true);
    if (ok) setDraft(null);
  };

  const remove = async (f: CustomizationField) => {
    // ⚠️ `confirm` هنا مقصود: المسح مالوش رجوع، والطلبات القديمة محفوظة
    //    بس الخانة نفسها بتختفي من كل المنتجات.
    if (!window.confirm(`تمسح خانة «${f.label}»؟ الطلبات القديمة مش هتتأثر.`)) return;
    await run(() => deleteCustomizationField(f.id));
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = moveItem(rows, index, direction);
    if (!next || busy) return;
    const before = rows;
    setRows(next);
    const ok = await run(() => reorderCustomizationFields(next.map((r) => r.id)));
    if (!ok) setRows(before);
  };

  return (
    <div className="space-y-4">
      <FormError message={errorInForm ? '' : error} />

      {rows.length === 0 && !draft && (
        <p className="rounded-3xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          مفيش خانات إضافية لسه — العميل بيشوف الخانات الأساسية بس.
        </p>
      )}

      <ol className="space-y-2">
        {rows.map((f, i) =>
          draft?.id === f.id ? (
            <li key={f.id}>
              <FieldForm
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                busy={busy}
                saving={busy && errorInForm}
                error={formError}
                products={products}
                appliesToReady={appliesToReady}
              />
            </li>
          ) : (
            <li
              key={f.id}
              className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
                f.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800">
                  {f.label}
                  {f.isRequired && <span className="mr-2 text-xs font-bold text-rose-700">إلزامية</span>}
                  {!f.isActive && <span className="mr-2 text-xs font-bold text-slate-500">موقوفة</span>}
                </p>
                {f.placeholder && (
                  <p className="truncate text-xs font-medium text-slate-500">مثال: {f.placeholder}</p>
                )}
                <p className="text-xs font-bold text-blue-700">{appliesToSummary(f.appliesTo)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton label={`حرّك ${f.label} لفوق`} disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={`حرّك ${f.label} لتحت`}
                  disabled={i === rows.length - 1 || busy}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={`عدّل ${f.label}`}
                  disabled={busy}
                  onClick={() =>
                    setDraft({
                      id: f.id,
                      label: f.label,
                      placeholder: f.placeholder ?? '',
                      isRequired: f.isRequired,
                      isActive: f.isActive,
                      appliesTo: f.appliesTo,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label={`امسح ${f.label}`} disabled={busy} onClick={() => remove(f)} danger>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </li>
          ),
        )}
      </ol>

      {draft && !draft.id ? (
        <FieldForm
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          busy={busy}
          saving={busy && errorInForm}
          error={formError}
          products={products}
          appliesToReady={appliesToReady}
        />
      ) : (
        !draft &&
        rows.length < FIELDS_MAX && (
          <button
            type="button"
            onClick={() => setDraft({ ...empty })}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> خانة جديدة
          </button>
        )
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30 ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function FieldForm({
  draft,
  setDraft,
  onSave,
  busy,
  saving,
  error,
  products,
  appliesToReady,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  onSave: () => void;
  busy: boolean;
  /** الحفظ بالذات هو اللي شغّال (مش ترتيب أو مسح) — عشان «جارٍ الحفظ…». */
  saving: boolean;
  error: string;
  products: AppliesToProduct[];
  appliesToReady: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <FormError message={error} />
      <Field label="اسم الخانة" required hint="زي ما العميل هيشوفه بالظبط.">
        <TextInput
          maxLength={LABEL_MAX}
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="مثال: اللون المفضل للطفل"
        />
      </Field>
      <Field label="مثال جوّه الخانة" hint="اختياري — بيظهر باهت جوّه الخانة لحد ما العميل يكتب.">
        <TextInput
          maxLength={PLACEHOLDER_MAX}
          value={draft.placeholder}
          onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })}
          placeholder="مثال: أزرق"
        />
      </Field>
      <div className="flex flex-wrap gap-6">
        <Checkbox
          label="إلزامية"
          checked={draft.isRequired}
          onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })}
        />
        <Checkbox
          label="ظاهرة للعملاء"
          checked={draft.isActive}
          onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
        />
      </div>
      <AppliesToPicker
        value={draft.appliesTo}
        onChange={(appliesTo) => setDraft({ ...draft, appliesTo })}
        products={products}
        disabled={busy}
        unavailable={!appliesToReady}
      />
      <div className="flex gap-2">
        <BusyButton busy={saving} disabled={busy} onClick={onSave}>
          حفظ
        </BusyButton>
        <BusyButton busy={false} variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
          إلغاء
        </BusyButton>
      </div>
    </div>
  );
}
