import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getInstructorSessions } from '@/data/domains/writing';
import { InstructorSessionsClient } from './InstructorSessionsClient';

export const dynamic = 'force-dynamic';

/**
 * جلسات المدرب مع إمكانية البحث والفلترة والصفحات (Pagination).
 */
export default async function Page() {
  const sessions = await getInstructorSessions();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-10 space-y-6">
      <DashboardPageHeader
        title="جلساتي التدريبية"
        backHref="/dashboard/instructor"
      />

      <InstructorSessionsClient sessions={sessions} />
    </div>
  );
}
