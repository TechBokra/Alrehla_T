import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ServiceOrderDetail } from '@/components/services/ServiceOrderDetail';
import { OrderFilesSection } from '@/components/files/OrderFilesSection';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getServiceOrderDetail } from '@/data/domains/(shared)/service-orders/queries';
import { getServiceOrderMessages } from '@/data/domains/(shared)/service-orders/messages';
import { hasReviewForOrder } from '@/data/domains/(client)/reviews/queries';
import { ReviewForm } from '@/components/services/ReviewForm';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  // Row-level security already limits this read to the buyer, the assigned
  // instructor and admins, so "not found" covers "not yours" too.
  const order = await getServiceOrderDetail(id);
  if (!order || order.buyerProfileId !== user.id) notFound();

  const messages = await getServiceOrderMessages(id);
  const alreadyReviewed =
    order.status === 'completed' ? await hasReviewForOrder(id) : true;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="تفاصيل الطلب" backHref="/account/orders/creative-writing" />
      {order.status === 'completed' && !alreadyReviewed && (
        <ReviewForm
          target={{ kind: 'service', orderId: order.id }}
          serviceName={order.serviceName}
          instructorName={order.instructorName}
        />
      )}
      <ServiceOrderDetail
        order={order}
        messages={messages}
        viewer="customer"
        currentProfileId={user.id}
        filesSlot={<OrderFilesSection order={order} viewer="customer" />}
      />
    </div>
  );
}
