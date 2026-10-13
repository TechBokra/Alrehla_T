import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getDocumentById } from '@/data/domains/(shared)/portfolio/queries';
import { getStudentSessions } from '@/data/domains/(client)/sessions/queries';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DocumentEditorClient } from '@/app/(admin)/dashboard/student/portfolio/[id]/DocumentEditorClient';
import { DocumentFilesSection } from '@/components/files/DocumentFilesSection';

export const dynamic = 'force-dynamic';

/** نص في مساحة كتابة العميل — نفس محرّر الطفل (`/account/writing`). */
export default async function AccountDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect('/sign-in?next=/account/writing');
  if (user.role === 'student') redirect('/dashboard/student/portfolio');

  const { id } = await params;
  const document = id === 'new' ? null : await getDocumentById(id);
  // مستند حد تاني (ابنه مثلًا) — القراية لولي الأمر من صفحة الطفل.
  if (id !== 'new' && (!document || document.studentId !== user.id)) redirect('/account/writing');

  // «معاه مدرب» = عنده جلسة في باقة لنفسه مسنَدة لمدرب.
  const sessions = await getStudentSessions();
  const hasInstructor = sessions.some((s) => Boolean(s.instructorName));

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={document ? 'تعديل النص' : 'نص جديد'} backHref="/account/writing" />
      <DocumentEditorClient
        initialDocument={document}
        hasInstructor={hasInstructor}
        basePath="/account/writing"
        filesSlot={document ? <DocumentFilesSection document={document} viewer="writer" /> : undefined}
      />
    </div>
  );
}
