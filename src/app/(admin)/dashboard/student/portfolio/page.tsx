import { getCurrentUser } from '@/data/domains/auth';
import { getStudentDocuments } from '@/data/domains/writing';
import { redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { PortfolioListClient } from './PortfolioListClient';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (user.role !== 'student') {
    redirect('/dashboard');
  }

  const documents = await getStudentDocuments(user.id);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title="الملف الكتابي ومساحة العمل" 
        backHref="/dashboard/student"
      />
      <PortfolioListClient documents={documents} />
    </div>
  );
}
