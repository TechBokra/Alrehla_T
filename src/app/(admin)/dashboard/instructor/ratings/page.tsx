import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getReviewsForInstructor, getInstructorRatingSummary } from '@/data/domains/reviews';
import { getMyInstructorId } from '@/data/domains/services';
import { Star } from 'lucide-react';
import { redirect } from 'next/navigation';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export default async function RatingsPage() {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') {
    redirect('/dashboard');
  }

  // This used to look reviews up by the user's profile id, which is never an
  // instructor id — so the list was always empty whatever was in the database.
  const instructorId = await getMyInstructorId();
  const [reviews, summary] = instructorId
    ? await Promise.all([
        getReviewsForInstructor(instructorId),
        getInstructorRatingSummary(instructorId),
      ])
    : [[], { average: null, count: 0 }];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="تقييمات الطلاب"
        backHref="/dashboard/instructor"
      />

      {summary.average != null && (
        <div className="mb-8 flex items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <Star className="h-10 w-10 fill-amber-400 text-amber-400" />
          <div>
            <p className="text-3xl font-black text-amber-900">
              {summary.average.toFixed(1)}<span className="text-lg">/5</span>
            </p>
            <p className="font-bold text-amber-700">من {summary.count} تقييم</p>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          لا توجد تقييمات حتى الآن.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map(review => (
            <div key={review.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="font-bold text-slate-800">{review.reviewerName}</div>
                <div className="text-xs font-bold text-slate-500">
                  {new Date(review.createdAt).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE })}
                </div>
              </div>
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star 
                    key={star} 
                    className={`h-5 w-5 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                  />
                ))}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed flex-1">
                {review.comment}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
