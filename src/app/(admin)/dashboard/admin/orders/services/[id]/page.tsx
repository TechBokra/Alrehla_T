import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ServiceOrderDetail } from '@/components/services/ServiceOrderDetail';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getServiceOrderDetail, getServiceOrderMessages } from '@/data/domains/services';
import { hasAdminPermission } from '@/lib/utils';
import { PaymentReviewPanel } from '@/components/admin/PaymentReviewPanel';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageOrders')) return <Unauthorized />;

  const order = await getServiceOrderDetail(id);
  if (!order) notFound();

  const messages = await getServiceOrderMessages(id);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title="تفاصيل الطلب" backHref="/dashboard/admin/orders/services" />
      <PaymentReviewPanel
        reference={order.paymentReference}
        amount={order.amount}
        method={order.paymentMethod}
        receiptUrl={order.paymentReceiptUrl}
        legacyReference={order.transactionReference}
      />
      <ServiceOrderDetail
        order={order}
        messages={messages}
        viewer="admin"
        currentProfileId={user.id}
      />
    </div>
  );
}
