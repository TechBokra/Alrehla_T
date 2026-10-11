import { formatDate, formatPrice } from '@/lib/utils';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { getPublisherOrders } from '@/data/domains/products';
import { StatusBadge } from '@/components/StatusBadge';
import { productOrderStatus } from '@/lib/order-status';
import { salesTotals } from '@/lib/publisher-sales';

export const dynamic = 'force-dynamic';

/**
 * طلبات كتب الناشر.
 *
 * ⚠️ **كانت بتقارن الحالة بـ`'completed'`** — والحالة دي مش موجودة في
 *    الطلبات أصلًا (ملف 139: `pending · awaiting_verification · paid ·
 *    preparing · shipped · delivered · …`). فكل طلب كان بيظهر «قيد
 *    الانتظار» حتى بعد ما يتسلّم. وكانت بتعرض إجمالي البند بدل نصيبه.
 */
export default async function PublisherOrdersPage() {
  const orders = await getPublisherOrders();
  const totals = salesTotals(orders);

  const formattedOrders = orders.map((order) => {
    const status = productOrderStatus(order.status);
    return {
      ...order,
      dateDisplay: formatDate(order.createdAt),
      amountDisplay: formatPrice(order.totalAmount),
      shareDisplay: <span className="font-bold text-emerald-700">{formatPrice(order.publisherShare)}</span>,
      statusDisplay: <StatusBadge type={status.type} label={status.label} />,
    };
  });

  const columns = [
    { header: 'الكتاب', accessorKey: 'productName' },
    { header: 'التاريخ', accessorKey: 'dateDisplay' },
    { header: 'الكمية', accessorKey: 'quantity' },
    { header: 'إجمالي البيع', accessorKey: 'amountDisplay' },
    { header: 'نصيبك', accessorKey: 'shareDisplay' },
    { header: 'حالة الطلب', accessorKey: 'statusDisplay' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات كتبك" backHref="/dashboard/publisher" />
      <p className="mb-6 text-sm text-slate-700">
        نصيبك من الطلبات المدفوعة: <span className="font-bold">{formatPrice(totals.earnings)}</span>
        {totals.awaitingCount > 0 && ` · ${totals.awaitingCount} طلب لسه بانتظار الدفع ومش محسوب`}.
        المستحق بيتسجّل لما الطلب يتسلّم للعميل.
      </p>
      <SimpleDataTable columns={columns} data={formattedOrders} emptyMessage="مفيش طلبات على كتبك لسه." />
    </div>
  );
}
