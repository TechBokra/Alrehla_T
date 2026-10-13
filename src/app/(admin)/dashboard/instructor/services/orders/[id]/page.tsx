import { notFound, redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ServiceOrderDetail } from '@/components/services/ServiceOrderDetail';
import { OrderFilesSection } from '@/components/files/OrderFilesSection';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getServiceOrderDetail } from '@/data/domains/(shared)/service-orders/queries';
import { getServiceOrderMessages } from '@/data/domains/(shared)/service-orders/messages';
import { getMyInstructorId } from '@/data/domains/(admin)/instructors/identity';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (user.role !== 'instructor') redirect('/dashboard');

  const instructorId = await getMyInstructorId();
  const order = await getServiceOrderDetail(id);
  if (!order || !instructorId || order.instructorId !== instructorId) notFound();

  const messages = await getServiceOrderMessages(id);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title="تفاصيل الطلب" backHref="/dashboard/instructor/services" />
      <ServiceOrderDetail
        order={order}
        messages={messages}
        viewer="instructor"
        currentProfileId={user.id}
        filesSlot={<OrderFilesSection order={order} viewer="instructor" />}
      />
    </div>
  );
}
