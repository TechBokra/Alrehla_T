import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  switch (user.role) {
    case 'student':
      redirect('/dashboard/student');
    case 'instructor':
      redirect('/dashboard/instructor');
    case 'service_provider':
      redirect('/dashboard/provider');
    case 'publisher':
      redirect('/dashboard/publisher');
    case 'customer':
      redirect('/account');
    case 'super_admin':
    case 'general_supervisor':
      redirect('/dashboard/admin');
    case 'visitor':
    default:
      redirect('/sign-in');
  }
}
