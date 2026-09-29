import React from 'react';
import { Star } from 'lucide-react';
import type { RatingSummary } from '@/data/domains/reviews';

/**
 * An instructor's rating.
 *
 * With no reviews yet this reads "مدرب جديد" rather than zero stars: a zero
 * looks like a bad rating, when it only means nobody has rated them.
 */
export function RatingStars({
  summary,
  size = 'md',
  newLabel = 'مدرب جديد',
}: {
  summary: RatingSummary;
  size?: 'sm' | 'md';
  newLabel?: string;
}) {
  const starClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';

  if (summary.average == null || summary.count === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-600 ${textClass}`}
      >
        {newLabel}
      </span>
    );
  }

  const rounded = Math.round(summary.average);

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${textClass}`}>
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`${starClass} ${
              n <= rounded ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
            }`}
          />
        ))}
      </span>
      <span className="text-slate-700">{summary.average.toFixed(1)}</span>
      <span className="font-medium text-slate-400">({summary.count})</span>
    </span>
  );
}
