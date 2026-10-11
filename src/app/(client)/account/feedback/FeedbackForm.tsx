'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { submitFeedback } from '@/actions/feedback';
import { FormError } from '@/components/ui/FormError';
import { Field, TextArea, BusyButton } from '@/components/forms/Form';
import { FEEDBACK_LINE_LABELS, type FeedbackLine } from '@/lib/feedback-lines';

export function FeedbackForm({ lines }: { lines: FeedbackLine[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  // خط واحد؟ مختار لوحده — مالوش لازمة يسأل.
  const [line, setLine] = useState<FeedbackLine | ''>(lines.length === 1 ? lines[0] : '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  // الخانة اللي الخادم رجّع عليها الخطأ (الرأي) — الرسالة بتظهر تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const send = () => {
    startTransition(async () => {
      setError('');
      setErrorField(undefined);
      const r = await submitFeedback({ line, rating, comment });
      if (!r.ok) {
        setError(r.error);
        setErrorField(r.field);
        return;
      }
      setSent(true);
      setRating(0);
      setComment('');
      router.refresh();
    });
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-black text-emerald-900">وصلنا رأيك — شكرًا</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 text-sm font-bold text-emerald-800 underline-offset-4 hover:underline"
        >
          اكتب رأي تاني
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
      {lines.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-slate-700">رأيك في إيه؟</legend>
          <div className="flex flex-wrap gap-2">
            {lines.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLine(l)}
                aria-pressed={line === l}
                className={`min-h-[44px] rounded-full border-2 px-5 text-sm font-bold transition-colors ${
                  line === l ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700'
                }`}
              >
                {FEEDBACK_LINE_LABELS[l]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {lines.length === 1 && (
        <p className="text-sm font-bold text-slate-700">رأيك في «{FEEDBACK_LINE_LABELS[lines[0]]}»</p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-slate-700">تقييمك</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} من ٥`}
              aria-pressed={rating === n}
              className="p-1"
            >
              <Star
                className={`h-8 w-8 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="احكيلنا (اختياري)"
        name="comment"
        error={errorField === 'comment' ? error : undefined}
      >
        <TextArea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="إيه اللي عجبك؟ وإيه اللي نحسّنه؟"
        />
      </Field>

      <FormError message={errorField === 'comment' ? '' : error} />

      <BusyButton
        busy={busy}
        pendingLabel="ابعت رأيك"
        onClick={send}
        disabled={!line || rating === 0}
      >
        ابعت رأيك
      </BusyButton>
    </div>
  );
}
