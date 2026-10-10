import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StudentSessionGroups } from '@/components/dashboard/StudentSessionGroups';
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

      <StudentSessionGroups upcoming={upcoming} past={past} />
    </div>
  );
}
