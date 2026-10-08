'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteStoryGoal, reorderStoryGoals, saveStoryGoal, setStoryGoalActive } from '@/actions/story-goals';
import { moveItem } from '@/lib/customization-fields';
import { GOAL_LABEL_MAX, GOALS_MAX, type StoryGoal } from '@/lib/story-goals';
import { appliesToSummary, type AppliesToProduct } from '@/lib/applies-to';
import { FormError } from '@/components/ui/FormError';
import { BusyButton, Checkbox, Field, TextInput } from '@/components/forms/Form';
import { AppliesToPicker } from '@/components/admin/AppliesToPicker';

type Draft = { id?: string; label: string; isActive: boolean; appliesTo: string[] | null };

const empty: Draft = { label: '', isActive: true, appliesTo: null };

type Result = { ok: true } | { ok: false; error: string };

export function StoryGoalsClient({ goals, products }: { goals: StoryGoal[]; products: AppliesToProduct[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(goals);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // ⚠️ خطأ الحفظ جوّه الفورم نفسه — فورم «هدف جديد» تحت آخر القايمة،
  //    ورسالة فوق الصفحة ماكانتش هتبان. (نفس شاشة الخانات.)
  const [errorInForm, setErrorInForm] = useState(false);
  const formError = errorInForm ? error : '';

  // القايمة بتتحدّث من الخادم بعد أي حفظ — بس الأسهم بتتحرك قدامك على طول.
  React.useEffect(() => setRows(goals), [goals]);

  const run = async (fn: () => Promise<Result>, inForm = false) => {
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
    const ok = await run(() => saveStoryGoal(draft), true);
    if (ok) setDraft(null);
  };

  const remove = async (g: StoryGoal) => {
    // ⚠️ المسح مالوش رجوع — و«أوقفه» بيخفيه من غير ما يضيع.
    if (!window.confirm(`تمسح هدف «${g.label}»؟ الطلبات القديمة مش هتتأثر. (لو مؤقتًا، أوقفه بدل كده.)`)) return;
    await run(() => deleteStoryGoal(g.id));
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = moveItem(rows, index, direction);
    if (!next || busy) return;
    const before = rows;
    setRows(next);
    const ok = await run(() => reorderStoryGoals(next.map((r) => r.id)));
    if (!ok) setRows(before);
  };

  const activeCount = rows.filter((g) => g.isActive).length;

  return (
    <div className="space-y-4">
      <FormError message={errorInForm ? '' : error} />

      {rows.length > 0 && activeCount === 0 && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          كل الأهداف موقوفة — العميل هيشوف الأربعة أهداف الأساسية لحد ما تفعّل واحد.
        </p>
      )}

      {rows.length === 0 && !draft && (
        <p className="rounded-3xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          مفيش أهداف لسه — العميل بيشوف الأربعة أهداف الأساسية لحد ما تضيف.
        </p>
      )}

      <ol className="space-y-2">
        {rows.map((g, i) =>
          draft?.id === g.id ? (
            <li key={g.id}>
              <GoalForm
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                busy={busy}
                saving={busy && errorInForm}
                error={formError}
                products={products}
              />
            </li>
          ) : (
            <li
              key={g.id}
              className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center ${
                g.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800">
                  {g.label}
                  {!g.isActive && <span className="mr-2 text-xs font-bold text-slate-500">موقوف</span>}
                </p>
                <p className="text-xs font-bold text-blue-700">{appliesToSummary(g.appliesTo)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <IconButton label={`حرّك ${g.label} لفوق`} disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={`حرّك ${g.label} لتحت`}
                  disabled={i === rows.length - 1 || busy}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={g.isActive ? `أوقف ${g.label}` : `فعّل ${g.label}`}
                  disabled={busy}
                  onClick={() => run(() => setStoryGoalActive(g.id, !g.isActive))}
                >
                  {g.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </IconButton>
                <IconButton
                  label={`عدّل ${g.label}`}
                  disabled={busy}
                  onClick={() => setDraft({ id: g.id, label: g.label, isActive: g.isActive, appliesTo: g.appliesTo })}
                >
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label={`امسح ${g.label}`} disabled={busy} onClick={() => remove(g)} danger>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </li>
          ),
        )}
      </ol>

      {draft && !draft.id ? (
        <GoalForm
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          busy={busy}
          saving={busy && errorInForm}
          error={formError}
          products={products}
        />
      ) : (
        !draft &&
        rows.length < GOALS_MAX && (
          <button
            type="button"
            onClick={() => setDraft({ ...empty })}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> هدف جديد
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

function GoalForm({
  draft,
  setDraft,
  onSave,
  busy,
  saving,
  error,
  products,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  onSave: () => void;
  busy: boolean;
  /** الحفظ بالذات هو اللي شغّال (مش ترتيب أو مسح) — عشان «جارٍ الحفظ…». */
  saving: boolean;
  error: string;
  products: AppliesToProduct[];
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <FormError message={error} />
      <Field label="الهدف" required hint="زي ما العميل هيشوفه في القايمة بالظبط — وده اللي بيتحفظ في الطلب.">
        <TextInput
          maxLength={GOAL_LABEL_MAX}
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="مثال: الصبر وانتظار الدور"
        />
      </Field>
      <AppliesToPicker
        value={draft.appliesTo}
        onChange={(appliesTo) => setDraft({ ...draft, appliesTo })}
        products={products}
        disabled={busy}
      />
      <Checkbox
        label="ظاهر للعملاء"
        checked={draft.isActive}
        onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
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
