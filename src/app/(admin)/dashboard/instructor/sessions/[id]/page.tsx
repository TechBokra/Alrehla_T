import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getInstructorSessionPageData } from '@/data/domains/(admin)/sessions/page-data';
import { FormError } from '@/components/ui/FormError';
import { notFound, redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { InstructorSessionClient } from './InstructorSessionClient';
import { SessionRecordingNotice } from '@/components/SessionRecordingNotice';
import { SessionChangeRequest } from '@/components/sessions/SessionChangeRequest';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') {
    redirect('/dashboard');
  }

  const { id } = await params;
  const result = await getInstructorSessionPageData(id);
  if (!result.success) return <FormError message={result.error.message} />;
  if (!result.data) notFound();
  const { session, settings, content, change, report, canRequestChange } = result.data;

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
      <InstructorSessionClient session={session} savedReport={report} />
      {/* ⭐ (#LQMO) المدرب يطلب موعد تاني — الإدارة بتوافق. */}
      {canRequestChange && (
        <div className="mt-6">
          <SessionChangeRequest sessionId={session.id} existing={change} />
        </div>
      )}
    </div>
  );
}
