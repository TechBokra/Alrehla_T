'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import type { Testimonial } from '@/types';
import { saveTestimonial, deleteTestimonial } from '@/actions/content';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500';

export function TestimonialsClient({ testimonials }: { testimonials: Testimonial[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [draft, setDraft] = useState({ authorName: '', authorRole: '', content: '' });

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      await saveTestimonial(null, draft);
      setDraft({ authorName: '', authorRole: '', content: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إضافة الرأي');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await deleteTestimonial(id);
      setConfirmId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حذف الرأي');
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-800">إضافة رأي جديد</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">اسم صاحب الرأي</label>
            <input
              className={inputClass}
              value={draft.authorName}
              onChange={(e) => setDraft({ ...draft, authorName: e.target.value })}
              placeholder="مثال: أ. منى حسن"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">صفته</label>
            <input
              className={inputClass}
              value={draft.authorRole}
              onChange={(e) => setDraft({ ...draft, authorRole: e.target.value })}
              placeholder="مثال: ولي أمر — القاهرة"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-bold text-slate-700">نص الرأي</label>
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={add}
            disabled={busy || !draft.authorName.trim() || !draft.content.trim()}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" /> إضافة
          </button>
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

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await saveTestimonial(testimonial.id, value);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الرأي');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <input
          className={inputClass}
          value={value.authorName}
          onChange={(e) => {
            setValue({ ...value, authorName: e.target.value });
            setSaved(false);
          }}
        />
        <input
          className={inputClass}
          value={value.authorRole}
          onChange={(e) => {
            setValue({ ...value, authorRole: e.target.value });
            setSaved(false);
          }}
        />
        <textarea
          rows={3}
          className={`${inputClass} resize-y md:col-span-2`}
          value={value.content}
          onChange={(e) => {
            setValue({ ...value, content: e.target.value });
            setSaved(false);
          }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        {confirmId === testimonial.id ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-red-700">حذف نهائي؟</span>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              نعم، احذف
            </button>
            <button
              type="button"
              onClick={() => setConfirmId(null)}
              className="font-bold text-slate-500"
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
          {saved && <span className="text-sm font-bold text-emerald-700">تم الحفظ</span>}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-6 py-2.5 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
