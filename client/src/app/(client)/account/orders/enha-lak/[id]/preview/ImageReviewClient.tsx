'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, MessageSquarePlus, Clock, PenLine } from 'lucide-react';
import { decideCharacterImage } from '@/actions/image-review';
import { Field, TextArea } from '@/components/forms/Form';
import { IMAGE_NOTE_MAX, imageNoteProblem, imageReviewState, type ImageReviewRow } from '@/lib/image-review';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

const TONE = {
  awaiting: 'border-amber-300 bg-amber-50 text-amber-900',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  changes: 'border-sky-200 bg-sky-50 text-sky-900',
  closed: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-EG', {
    timeZone: PLATFORM_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * صورة البطل + قرار ولي الأمر.
 *
 * ⚠️ الزرارين بنفس الحجم: له حق يقول لأ بنفس سهولة «موافق».
 */
export function ImageReviewCard({
  row,
  orderId,
  productName,
  delayNote,
}: {
  row: ImageReviewRow;
  orderId: string;
  productName: string;
  delayNote: string;
}) {
  const state = imageReviewState(row);
  const [mode, setMode] = useState<'idle' | 'changes'>('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = (approve: boolean) => {
    setError('');
    if (!approve) {
      const problem = imageNoteProblem(note);
      if (problem) {
        setError(problem);
        return;
      }
    }
    startTransition(async () => {
      const result = await decideCharacterImage({
        reviewId: row.reviewId,
        orderId,
        approve,
        note: approve ? undefined : note,
      });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <header className="mb-6">
        <h2 className="text-xl font-black text-slate-900">{productName}</h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <Clock className="h-4 w-4" aria-hidden="true" />
          وصلتك {when(row.sentAt)}
        </p>
      </header>

      <div className={`mb-6 rounded-2xl border p-5 ${TONE[state.kind]}`}>
        <p className="font-black">{state.title}</p>
        <p className="mt-1 text-sm font-medium leading-relaxed">{state.text}</p>
        {state.kind === 'awaiting' && <p className="mt-2 text-sm font-bold leading-relaxed">{delayNote}</p>}
      </div>

      <div className="flex justify-center rounded-2xl bg-slate-50 p-4 md:p-6">
        <img
          src={row.imageUrl}
          alt={`صورة البطل — ${productName}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="max-h-[32rem] w-auto rounded-2xl object-contain"
        />
      </div>

      {row.staffNote && (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-700">
          <span className="font-black">ملاحظة الفريق: </span>
          {row.staffNote}
        </p>
      )}

      {state.kind === 'awaiting' && (
        <div className="mt-6">
          {mode === 'idle' ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(true)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-70"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                {pending ? 'جارٍ التسجيل…' : 'الصورة عاجباني — ابدأوا الرسم'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setMode('changes')}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 px-6 py-3 font-black text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-70"
              >
                <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
                فيه حاجة عايزة تتعدّل
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-5">
              <Field
                label="عايز نعدّل إيه في الصورة؟"
                name="note"
                required
                hint="مثال: «الشعر أطول وأغمق» أو «النضارة مش موجودة»."
                error={error}
              >
                <TextArea
                  rows={4}
                  maxLength={IMAGE_NOTE_MAX}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (error) setError('');
                  }}
                />
              </Field>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(false)}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-black text-white transition-colors hover:bg-slate-800 disabled:opacity-70"
                >
                  <PenLine className="h-5 w-5" aria-hidden="true" />
                  {pending ? 'جارٍ الإرسال…' : 'ابعت الملاحظة'}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMode('idle');
                    setError('');
                  }}
                  className="min-h-[44px] rounded-xl px-6 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-70"
                >
                  رجوع
                </button>
              </div>
            </div>
          )}

          {error && mode === 'idle' && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      {row.decidedAt && (
        <footer className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">
          <p className="font-bold text-slate-700">قرارك اتسجّل {when(row.decidedAt)}</p>
          {row.clientNote && <p className="mt-1 leading-relaxed">{row.clientNote}</p>}
        </footer>
      )}
    </article>
  );
}
