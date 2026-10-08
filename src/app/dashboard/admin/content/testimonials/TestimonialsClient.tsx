'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import type { Testimonial } from '@/types';
import { saveTestimonial, deleteTestimonial } from '@/actions/content';
import { Field, TextInput, TextArea, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

/**
 * أكشنز الآراء بقت **بترجّع** `{ ok:false, error }` بدل ما ترمي — فرسالة
 * الفشل بتيجي في `result.error`. الـcatch فاضل بس لانقطاع النت أو خطأ
 * مش متوقع (وNext بيمسح نصه في الإنتاج)، فبنعرض رسالة عربية بديلة.
 */
const messageOf = (err: unknown, fallback: string) => {
  const raw = err instanceof Error ? err.message.trim() : '';
  return /[\u0600-\u06FF]/.test(raw) ? raw : fallback;
};

export function TestimonialsClient({ testimonials }: { testimonials: Testimonial[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // `busy` مشترك وبيقفل كل الأزرار؛ ده بس عشان «جارٍ…» تظهر على الزرار
  // اللي اتداس فعلًا مش على كل الصفوف.
  const [adding, setAdding] = useState(false);

  const [draft, setDraft] = useState({ authorName: '', authorRole: '', content: '' });

  const add = async () => {
    setBusy(true);
    setAdding(true);
    setError('');
    try {
      const result = await saveTestimonial(null, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft({ authorName: '', authorRole: '', content: '' });
      router.refresh();
    } catch (err) {
      setError(messageOf(err, 'تعذّر إضافة الرأي — الاتصال بالخادم — اتأكد من النت وجرّب تاني.'));
    } finally {
      setBusy(false);
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await deleteTestimonial(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmId(null);
      router.refresh();
    } catch (err) {
      setError(messageOf(err, 'تعذّر حذف الرأي — الاتصال بالخادم — اتأكد من النت وجرّب تاني.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
        الآراء دي بتظهر في ثلاث أماكن: الصفحة الرئيسية، وصفحة «إنها لك»،
        وصفحة «بداية الرحلة». صفحة «بداية الرحلة» بتعرض الآراء اللي صفة صاحبها
        فيها كلمة «ولي» فقط.
      </div>

      <FormError message={error} />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-800">إضافة رأي جديد</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* النجمة علامة بس — الإضافة مقفولة أصلًا من غير اسم ونص. */}
          <Field label="اسم صاحب الرأي" required>
            <TextInput
              value={draft.authorName}
              onChange={(e) => setDraft({ ...draft, authorName: e.target.value })}
              placeholder="مثال: أ. منى حسن"
            />
          </Field>
          <Field label="صفته" hint="لو فيها كلمة «ولي» الرأي بيظهر كمان في «بداية الرحلة».">
            <TextInput
              value={draft.authorRole}
              onChange={(e) => setDraft({ ...draft, authorRole: e.target.value })}
              placeholder="مثال: ولي أمر — القاهرة"
            />
          </Field>
          <Field label="نص الرأي" required className="md:col-span-2">
            <TextArea
              className="resize-y"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <BusyButton
            busy={adding}
            pendingLabel="جارٍ الإضافة…"
            onClick={add}
            disabled={busy || !draft.authorName.trim() || !draft.content.trim()}
          >
            <Plus className="h-5 w-5" /> إضافة
          </BusyButton>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-800">
          الآراء المنشورة ({testimonials.length})
        </h2>

        {testimonials.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center font-medium text-slate-500">
            لا توجد آراء بعد. أقسام «ماذا يقولون عنا» بتفضل مخفية لحد ما تضيف أول رأي.
          </div>
        ) : (
          testimonials.map((t) => (
            <TestimonialRow
              key={t.id}
              testimonial={t}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              onDelete={() => remove(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TestimonialRow({
  testimonial,
  busy,
  setBusy,
  setError,
  confirmId,
  setConfirmId,
  onDelete,
}: {
  testimonial: Testimonial;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  confirmId: string | null;
  setConfirmId: (v: string | null) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState({
    authorName: testimonial.authorName,
    authorRole: testimonial.authorRole,
    content: testimonial.content,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setBusy(true);
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await saveTestimonial(testimonial.id, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(messageOf(err, 'تعذّر حفظ الرأي — الاتصال بالخادم — اتأكد من النت وجرّب تاني.'));
    } finally {
      setBusy(false);
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="اسم صاحب الرأي" required>
          <TextInput
            value={value.authorName}
            onChange={(e) => {
              setValue({ ...value, authorName: e.target.value });
              setSaved(false);
            }}
          />
        </Field>
        <Field label="صفته">
          <TextInput
            value={value.authorRole}
            onChange={(e) => {
              setValue({ ...value, authorRole: e.target.value });
              setSaved(false);
            }}
          />
        </Field>
        <Field label="نص الرأي" required className="md:col-span-2">
          <TextArea
            className="resize-y"
            value={value.content}
            onChange={(e) => {
              setValue({ ...value, content: e.target.value });
              setSaved(false);
            }}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        {confirmId === testimonial.id ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-red-700">حذف نهائي؟</span>
            <BusyButton busy={busy} variant="danger" pendingLabel="جارٍ الحذف…" onClick={onDelete}>
              نعم، احذف
            </BusyButton>
            <button
              type="button"
              onClick={() => setConfirmId(null)}
              disabled={busy}
              className="font-bold text-slate-500 disabled:opacity-50"
            >
              تراجع
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmId(testimonial.id)}
            className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" /> حذف
          </button>
        )}

        <div className="flex items-center gap-4">
          {saved && (
            <span role="status" className="text-sm font-bold text-emerald-700">
              تم الحفظ
            </span>
          )}
          <BusyButton busy={saving} disabled={busy} onClick={save}>
            حفظ
          </BusyButton>
        </div>
      </div>
    </div>
  );
}
