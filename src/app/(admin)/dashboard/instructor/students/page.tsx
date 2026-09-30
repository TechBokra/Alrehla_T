import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { getInstructorStudents } from '@/data/domains/writing';

export const dynamic = 'force-dynamic';

export default async function InstructorStudentsPage() {
  const students = await getInstructorStudents();

  const formattedStudents = students.map(student => ({
    ...student,
    progress: `${student.sessionsCompleted} / ${student.totalSessions}`,
    action: (
      <Link 
        href={`/dashboard/instructor/students/${student.id}`} 
        className="text-blue-600 font-bold hover:underline"
      >
        عرض التفاصيل
      </Link>
    )
  }));

  const columns = [
    { header: 'اسم المتدرب', accessorKey: 'name' },
    { header: 'الباقة', accessorKey: 'packageName' },
    { header: 'التقدم', accessorKey: 'progress' },
    { header: 'الإجراء', accessorKey: 'action' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title="قائمة المتدربين" 
        backHref="/dashboard/instructor"
      />
      <SimpleDataTable columns={columns} data={formattedStudents} />
    </div>
  );
}
