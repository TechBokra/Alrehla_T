import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getMyFeedbackContext } from '@/data/domains/feedback';
import { FEEDBACK_LINE_LABELS } from '@/lib/feedback-lines';
import { formatDate } from '@/lib/utils';
import { FeedbackForm } from './FeedbackForm';

export const dynamic = 'force-dynamic';

/**
 * «رأيك يهمنا» — الرأي بيروح لقسمه (ملاحظة تامر): «إنها لك» لو اشتريت
 * منها، و«بداية الرحلة» لو اشتركت فيها، والاتنين لو استعملتهم.
 */
export default async function FeedbackPage() {
  const ctx = await getMyFeedbackContext();

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="رأيك يهمنا" />

      {ctx === null ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center font-medium text-slate-600">
          الخدمة دي هتشتغل قريب.
        </p>
      ) : ctx.lines.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="font-bold text-slate-700">تقدر تكتب رأيك بعد أول طلب أو اشتراك.</p>
          <p className="mt-2 text-sm font-medium text-slate-500">
            <Link href="/enha-lak" className="text-blue-700 hover:underline">إنها لك</Link>
            {' · '}
            <Link href="/creative-writing" className="text-blue-700 hover:underline">بداية الرحلة</Link>
          </p>
        </div>
      ) : (
        <FeedbackForm lines={ctx.lines} />
      )}

      {ctx && ctx.mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-800">آراؤك اللي بعتها</h2>
          <ul className="space-y-3">
            {ctx.mine.map((f) => (
              <li key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-700">
                  <span>{FEEDBACK_LINE_LABELS[f.line]}</span>
                  <span className="text-amber-500" aria-label={`${f.rating} من ٥`}>
                    {'★'.repeat(f.rating)}
                    <span className="text-slate-300">{'★'.repeat(5 - f.rating)}</span>
                  </span>
                  <span className="text-xs font-medium text-slate-400">{formatDate(f.createdAt)}</span>
                </div>
                {f.comment && <p className="text-sm text-slate-600">{f.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
