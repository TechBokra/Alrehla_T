'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Star } from 'lucide-react';
import { submitFeedback } from '@/actions/feedback';
import { FormError } from '@/components/ui/FormError';
import { FEEDBACK_LINE_LABELS, type FeedbackLine } from '@/lib/feedback-lines';

export function FeedbackForm({ lines }: { lines: FeedbackLine[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  // خط واحد؟ مختار لوحده — مالوش لازمة يسأل.
  const [line, setLine] = useState<FeedbackLine | ''>(lines.length === 1 ? lines[0] : '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const send = () => {
    startTransition(async () => {
      setError('');
      const r = await submitFeedback({ line, rating, comment });
      if (!r.ok) {
        setError(r.error);
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

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">احكيلنا (اختياري)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="إيه اللي عجبك؟ وإيه اللي نحسّنه؟"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
        />
      </label>

      <FormError message={error} />

      <button
        type="button"
        onClick={send}
        disabled={busy || !line || rating === 0}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-6 font-bold text-white hover:bg-slate-800 disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        ابعت رأيك
      </button>
    </div>
  );
}
