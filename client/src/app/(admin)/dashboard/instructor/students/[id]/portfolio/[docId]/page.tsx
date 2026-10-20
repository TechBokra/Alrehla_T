import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getDocumentById } from '@/data/domains/(shared)/portfolio/queries';
import { getInstructorStudents } from '@/data/domains/(admin)/instructors/students';
import { notFound, redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { InstructorDocumentClient } from './InstructorDocumentClient';
import { DocumentFilesSection } from '@/components/files/DocumentFilesSection';

export const dynamic = 'force-dynamic';

export default async function InstructorDocumentPage({ params }: { params: Promise<{ id: string, docId: string }> }) {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') {
    redirect('/dashboard');
  }

  const { id: studentId, docId } = await params;
  
  // من غير الطالب ده في قايمة طلابي، مفيش صفحة. كان بيعرض اسم أول
  // طالب في القايمة بدل ما يقول إن الرقم مش بتاعه.
  const students = await getInstructorStudents();
  const student = students.find(s => s.id === studentId);
  if (!student) notFound();

  const document = await getDocumentById(docId);

  if (!document) {
    redirect(`/dashboard/instructor/students/${studentId}`);
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-8">
      <DashboardPageHeader 
        title={`مراجعة نص: ${document.title}`} 
        backHref={`/dashboard/instructor/students/${studentId}`}
      />
      <InstructorDocumentClient document={document} studentName={student.name} />
      {/* ملفات الكاتب، وتصحيحك كملف (ملف 20). */}
      <div className="mt-6">
        <DocumentFilesSection document={document} viewer="instructor" />
      </div>
    </div>
  );
}
