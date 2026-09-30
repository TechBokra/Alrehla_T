import { getCurrentUser } from '@/data/domains/auth';
import { getInstructorSessions } from '@/data/domains/writing';
import { notFound, redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { InstructorSessionClient } from './InstructorSessionClient';
import { getSiteSettings, getSiteContent } from '@/data/domains/content';
import { SessionRecordingNotice } from '@/components/SessionRecordingNotice';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') {
    redirect('/dashboard');
  }

  const { id } = await params;
  // رقم الجلسة في الرابط كان بيتقرا وما بيتستخدمش: الصفحة كانت بتعرض
  // **أول جلسة في القايمة** مهما كان الرابط، بتعليق «mock first booking».
  const [sessions, settings, content] = await Promise.all([
    getInstructorSessions(),
    getSiteSettings(),
    getSiteContent(),
  ]);
  const session = sessions.find((s) => s.id === id);
  if (!session) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title={`جلسة ${session.sessionNumber} — ${session.packageName}`}
        backHref="/dashboard/instructor"
      />
      {/* المدرب لازم يعرف إنه متسجَّل قبل ما يدخل — ده حقّه هو كمان،
          مش إفصاح لولي الأمر وحده. */}
      <SessionRecordingNotice
        enabled={settings.sessionRecording.enabled}
        retentionDays={settings.sessionRecording.retentionDays}
        template={content['recording.notice']}
        className="mb-6"
      />
      <InstructorSessionClient session={session} />
    </div>
  );
}
