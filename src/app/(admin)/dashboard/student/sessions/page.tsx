import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SessionsList, SessionRow } from '@/components/dashboard/SessionsList';
import { getStudentSessions } from '@/data/domains/writing';

export const dynamic = 'force-dynamic';

/**
 * جلسات الطالب — نفس الفجوة اللي كانت عند المدرب بالظبط.
 */
export default async function Page() {
  // بتشتغل للطالب البالغ وللطفل صاحب الحساب التابع. `getSessions()`
  // العامة كانت بتدّي الطفل صفر جلسات، لأن الاشتراك صاحبه ولي الأمر.
  const sessions = await getStudentSessions();

  const rows: SessionRow[] = sessions.map((session) => ({
    id: session.id,
    href: `/dashboard/student/sessions/${session.id}`,
    title: `الجلسة ${session.sessionNumber}`,
    subtitle: session.instructorName
      ? `${session.packageName} · ${session.instructorName}`
      : session.packageName,
    scheduledAt: session.scheduledAt,
    status: session.status,
    meetingUrl: session.meetingUrl,
  }));

  const upcoming = rows.filter((r) => new Date(r.scheduledAt).getTime() >= Date.now());
  const past = rows
    .filter((r) => new Date(r.scheduledAt).getTime() < Date.now())
    .reverse();

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
