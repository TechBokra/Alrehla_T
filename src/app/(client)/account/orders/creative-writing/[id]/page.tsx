import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ServiceOrderDetail } from '@/components/services/ServiceOrderDetail';
import { getCurrentUser } from '@/data/domains/auth';
import { getServiceOrderDetail, getServiceOrderMessages } from '@/data/domains/services';
import { hasReviewForOrder } from '@/data/domains/reviews';
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
          orderId={order.id}
          serviceName={order.serviceName}
          instructorName={order.instructorName}
        />
      )}
      <ServiceOrderDetail
        order={order}
        messages={messages}
        viewer="customer"
        currentProfileId={user.id}
      />
    </div>
  );
}
