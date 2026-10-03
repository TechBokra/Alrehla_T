'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { FormError } from '@/components/ui/FormError';

type Draft = { id?: string; label: string; placeholder: string; isRequired: boolean; isActive: boolean };

const empty: Draft = { label: '', placeholder: '', isRequired: false, isActive: true };

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export function CustomizationFieldsClient({ fields }: { fields: CustomizationField[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(fields);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // القايمة بتتحدّث من الخادم بعد أي حفظ — بس الأسهم بتتحرك قدامك على طول.
  React.useEffect(() => setRows(fields), [fields]);

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setError('');
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
    const ok = await run(() => saveCustomizationField(draft));
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
      <FormError message={error} />

      {rows.length === 0 && !draft && (
        <p className="rounded-3xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          مفيش خانات إضافية لسه — العميل بيشوف الخانات الأساسية بس.
        </p>
      )}

      <ol className="space-y-2">
        {rows.map((f, i) =>
          draft?.id === f.id ? (
            <li key={f.id}>
              <FieldForm draft={draft} setDraft={setDraft} onSave={save} busy={busy} />
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
        <FieldForm draft={draft} setDraft={setDraft} onSave={save} busy={busy} />
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
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <label htmlFor="cf-label" className="text-sm font-bold text-slate-700">
          اسم الخانة (زي ما العميل هيشوفه)
        </label>
        <input
          id="cf-label"
          className={inputClass}
          maxLength={LABEL_MAX}
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="مثال: اللون المفضل للطفل"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="cf-placeholder" className="text-sm font-bold text-slate-700">
          مثال جوّه الخانة (اختياري)
        </label>
        <input
          id="cf-placeholder"
          className={inputClass}
          maxLength={PLACEHOLDER_MAX}
          value={draft.placeholder}
          onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })}
          placeholder="مثال: أزرق"
        />
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={draft.isRequired}
            onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })}
            className="h-4 w-4"
          />
          إلزامية
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            className="h-4 w-4"
          />
          ظاهرة للعملاء
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          حفظ
        </button>
        <button
          type="button"
          onClick={() => setDraft(null)}
          disabled={busy}
          className="rounded-xl bg-slate-100 px-6 py-2.5 font-bold text-slate-700 hover:bg-slate-200"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
