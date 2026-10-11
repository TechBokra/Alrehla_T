import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { getStudyMaterials } from '@/data/domains/writing';

export const dynamic = 'force-dynamic';

export default async function StudyMaterialsPage() {
  const materials = await getStudyMaterials();

  const columns = [
    { header: 'اسم المادة', accessorKey: 'title' },
    { header: 'الوصف', accessorKey: 'description' },
    { header: 'الباقة المرتبطة', accessorKey: 'packageName' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title="المواد الدراسية" 
        backHref="/dashboard/student"
      />
      <SimpleDataTable columns={columns} data={materials} />
    </div>
  );
}
