import { formatPrice } from '@/lib/utils';
import { getOrders } from '@/data/domains/orders';
import { getPersonalizedProducts } from '@/data/domains/products';
import { FORMAT_LABELS } from '@/lib/item-format';
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
  const [allOrders, products] = await Promise.all([getOrders(), getPersonalizedProducts()]);
  const names = new Map(products.map((p) => [p.id, p.name]));
  const orders = allOrders.map(order => ({
    // ⚠️ الرقم المرجعي، مش رقم الصف: هو اللي العميل كتبه في ملاحظة التحويل،
    //    وهو اللي بيظهر للإدارة — فلو كلّم الدعم، الرقم واحد في الشاشتين.
    idDisplay: (
      <span dir="ltr" className="font-mono font-bold">
        {order.paymentReference ?? order.id.replace('ord-', '').toUpperCase()}
      </span>
    ),
    date: new Date(order.createdAt).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE }),
    statusDisplay: (
      <StatusBadge
        type={ORDER_STATUS[order.status]?.type ?? 'warning'}
        label={ORDER_STATUS[order.status]?.label ?? order.status}
      />
    ),
    // الإلكتروني مالوش رقم شحنة — بيتقال اتبعت ولا لسه (ملف 138).
    tracking: (
      <div className="flex flex-col gap-1">
        <span>{order.trackingReference || '—'}</span>
        {order.deliveryEmail && (
          <span className="text-xs font-bold text-slate-700">
            {order.electronicSentAt ? 'النسخة الإلكترونية اتبعتت ✓' : 'النسخة الإلكترونية: لسه'}
          </span>
        )}
      </div>
    ),
    total: formatPrice(order.totalAmount),
    itemsDisplay: (
      <div className="flex flex-col gap-1">
        {/* كان بيعرض رقم المنتج الداخلي («منتج (3f2a…)») بدل اسمه. */}
        {order.items.map((item, idx) => {
          const child = (item.customizationData as { childName?: unknown } | undefined)?.childName;
          return (
            <span key={idx}>
              {names.get(item.productId) ?? 'منتج لم يعد معروضًا'} × {item.quantity}
              {item.format && item.format !== 'printed' && (
                <span className="text-slate-600"> · {FORMAT_LABELS[item.format]}</span>
              )}
              {typeof child === 'string' && child.trim() && (
                <span className="text-slate-500"> — لـ{child.trim()}</span>
              )}
            </span>
          );
        })}
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
