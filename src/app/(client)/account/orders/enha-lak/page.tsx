import { formatPrice } from '@/lib/utils';
import { getOrders } from '@/data/domains/orders';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

// The order used to stop at "مدفوع" with nothing after it, so a customer who
// paid for a printed book was never told it had been sent.
const ORDER_STATUS: Record<string, { label: string; type: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  pending: { label: 'بانتظار الدفع', type: 'warning' },
  awaiting_verification: { label: 'بانتظار تأكيد الدفع', type: 'warning' },
  paid: { label: 'مدفوع', type: 'success' },
  preparing: { label: 'قيد التجهيز', type: 'warning' },
  shipped: { label: 'تم الشحن', type: 'success' },
  delivered: { label: 'تم التسليم', type: 'success' },
  cancelled: { label: 'ملغي', type: 'neutral' },
  refunded: { label: 'مسترجع', type: 'neutral' },
  failed: { label: 'فشل الدفع', type: 'danger' },
};



export default async function EnhaLakOrdersPage() {
  const allOrders = await getOrders();
  const orders = allOrders.map(order => ({
    idDisplay: `طلب #${order.id.replace('ord-', '').toUpperCase()}`,
    date: new Date(order.createdAt).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE }),
    statusDisplay: (
      <StatusBadge
        type={ORDER_STATUS[order.status]?.type ?? 'warning'}
        label={ORDER_STATUS[order.status]?.label ?? order.status}
      />
    ),
    tracking: order.trackingReference || '—',
    total: formatPrice(order.totalAmount),
    itemsDisplay: (
      <div className="flex flex-col gap-1">
        {order.items.map((item, idx) => <span key={idx}>منتج ({item.productId}) - كمية: {item.quantity}</span>)}
      </div>
    ),
  }));

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
    { header: 'التاريخ', accessorKey: 'date' },
    { header: 'الإجمالي', accessorKey: 'total' },
    { header: 'المنتجات', accessorKey: 'itemsDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
    { header: 'رقم الشحنة', accessorKey: 'tracking' }
  ];

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="المنتجات والاشتراكات" />
      <p className="mt-2 text-slate-500 font-medium">سجل طلباتك من معرض وقصص إنها لك.</p>
      <SimpleDataTable columns={columns} data={orders} />
    </div>
  );
}
