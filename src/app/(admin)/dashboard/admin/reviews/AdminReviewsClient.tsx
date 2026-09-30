'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, EyeOff, Eye } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ReviewItem } from '@/data/domains/reviews';
import { setReviewHidden } from '@/actions/reviews';

export function AdminReviewsClient({ reviews }: { reviews: ReviewItem[] }) {
  const router = useRouter();
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setHidingId(null);
      setReason('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setBusy(false);
    }
  };

  if (reviews.length === 0) {
    return (
      <p className="rounded-3xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
        لا توجد تقييمات بعد.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {reviews.map((review) => (
        <div
          key={review.id}
          className={`rounded-2xl border p-5 ${
            review.isHidden ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-black text-slate-800">{review.reviewerName}</span>
                <span className="text-xs font-bold text-slate-400">
                  {formatDate(review.createdAt)}
                </span>
                {review.isHidden && (
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    مخفي
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  المدرب:
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${
                        n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  ))}
                </span>
                {review.serviceRating != null && (
                  <span className="flex items-center gap-1">
                    الخدمة:
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= review.serviceRating!
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </span>
                )}
              </div>

              {review.comment && (
                <p className="mt-3 leading-relaxed font-medium whitespace-pre-wrap text-slate-600">
                  {review.comment}
                </p>
              )}

              {review.isHidden && review.hiddenReason && (
                <p className="mt-3 rounded-xl bg-white p-3 text-sm font-medium text-slate-500">
                  <span className="font-bold">سبب الإخفاء:</span> {review.hiddenReason}
                </p>
              )}
            </div>

            <div className="shrink-0">
              {review.isHidden ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => setReviewHidden(review.id, false, ''))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" /> إظهار
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReason('');
                    setHidingId(hidingId === review.id ? null : review.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                >
                  <EyeOff className="h-4 w-4" /> إخفاء
                </button>
              )}
            </div>
          </div>

          {hidingId === review.id && (
            <div className="mt-4 space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
              <label className="text-xs font-bold text-red-800">
                سبب الإخفاء (يُسجَّل في سجل التدقيق)
              </label>
              <input
                className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: لغة مسيئة"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHidingId(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => setReviewHidden(review.id, true, reason))}
                  className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  تأكيد الإخفاء
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
