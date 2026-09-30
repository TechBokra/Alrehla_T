import { getCurrentUser } from '@/data/domains/auth';
import { getDocumentById, getStudentSessions } from '@/data/domains/writing';
import { redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DocumentEditorClient } from './DocumentEditorClient';

export const dynamic = 'force-dynamic';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user.role !== 'student') {
    redirect('/dashboard');
  }

  const { id } = await params;
  
  // If id is 'new', we pass a null document
  const document = id === 'new' ? null : (await getDocumentById(id) || null);

  // «معاه مدرب» = عنده جلسة مسنَدة لمدرب. من غير ده زرار «إرسال للمدرب»
  // بيحوّل النص لـ«مُرسل» ومحدش يشوفه — طريق مسدود بلا رسالة.
  const sessions = await getStudentSessions();
  const hasInstructor = sessions.some((s) => Boolean(s.instructorName));

  if (id !== 'new' && !document) {
    redirect('/dashboard/student/portfolio');
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-8">
      <DashboardPageHeader 
        title={document ? 'تعديل النص' : 'نص جديد'} 
        backHref="/dashboard/student/portfolio"
      />
      <DocumentEditorClient initialDocument={document} hasInstructor={hasInstructor} />
    </div>
  );
}
