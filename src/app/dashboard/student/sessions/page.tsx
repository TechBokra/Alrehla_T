import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SessionsList } from '@/components/dashboard/SessionsList';
import { getStudentSessionsPageData } from '@/data/domains/session-pages';
import { FormError } from '@/components/ui/FormError';

export const dynamic = 'force-dynamic';

/**
 * جلسات الطالب — نفس الفجوة اللي كانت عند المدرب بالظبط.
 */
export default async function Page() {
  const result = await getStudentSessionsPageData();
  if (!result.success) return <FormError message={result.error.message} />;
  const { upcoming, past } = result.data;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="جلساتي" />

      <h2 className="mb-4 font-black text-slate-800">القادمة ({upcoming.length})</h2>
      <SessionsList sessions={upcoming} />

      {past.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 font-black text-slate-800">اللي عدّت ({past.length})</h2>
          <SessionsList sessions={past} />
        </>
      )}
    </div>
  );
}
