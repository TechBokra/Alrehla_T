import { formatDate , formatPrice } from '@/lib/utils';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { getPublisherOrders } from '@/data/domains/products';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function PublisherOrdersPage() {
  const orders = await getPublisherOrders();

  const formattedOrders = orders.map(order => ({
    ...order,
    orderIdDisplay: `طلب #${order.orderId.split('-')[1] || order.id}`,
    dateDisplay: formatDate(order.createdAt),
    amountDisplay: `${formatPrice(order.totalAmount)}`,
    statusDisplay: order.status === 'completed' 
      ? <StatusBadge type="success" label="مكتمل الدفع" />
      : <StatusBadge type="warning" label="قيد الانتظار" />
  }));

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'orderIdDisplay' },
    { header: 'التاريخ', accessorKey: 'dateDisplay' },
    { header: 'الإجمالي', accessorKey: 'amountDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title="جميع الطلبات" 
        backHref="/dashboard/publisher"
      />
      <SimpleDataTable columns={columns} data={formattedOrders} />
    </div>
  );
}
