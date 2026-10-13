import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { getOrders } from '@/data/domains/(client)/orders/queries';
import { getPersonalizedProducts } from '@/data/domains/(client)/products/queries';
import { getProductNamesFor } from '@/data/domains/(shared)/products/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { OrderLinesList } from '@/components/orders/OrderLinesList';
import { orderLines } from '@/lib/order-lines';
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
  const [allOrders, products, settings] = await Promise.all([
    getOrders(),
    getPersonalizedProducts(),
    getSiteSettings(),
  ]);
  const cancelDays = settings.pendingOrderCancelDays;
  const names: Record<string, string> = Object.fromEntries(products.map((p) => [p.id, p.name]));
  // المنتجات اللي اتخفت بعد ما العميل طلبها — اسمها بيفضل ظاهر في طلباته (4.4).
  const missing = allOrders.flatMap((o) => o.items.map((i) => i.productId)).filter((id) => id && !names[id]);
  Object.assign(names, await getProductNamesFor(missing));
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
      <div className="flex flex-col items-start gap-2">
        <StatusBadge
          type={ORDER_STATUS[order.status]?.type ?? 'warning'}
          label={ORDER_STATUS[order.status]?.label ?? order.status}
        />
        {/* الطلب اتسجّل والإيصال مااترفعش — كان مفيش رجوع ليه. */}
        {order.status === 'pending' && (
          <Link
            href={`/account/orders/enha-lak/${order.id}/pay`}
            className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
          >
            ادفع وارفع الإيصال
          </Link>
        )}
        {order.status === 'pending' && cancelDays > 0 && (
          <span className="text-xs text-slate-600">
            بيتلغي لوحده لو مااتدفعش خلال {cancelDays} أيام من الطلب
          </span>
        )}
      </div>
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
    // ⭐ كود الخصم وقيمته ظاهرين للعميل نفسه (طلب تامر).
    total: (
      <div className="flex flex-col gap-0.5">
        <span className="font-bold">{formatPrice(order.totalAmount)}</span>
        {order.discountCode && (
          <span className="text-xs font-bold text-emerald-800">
            شامل خصم <span dir="ltr" className="font-mono">{order.discountCode}</span> (− {formatPrice(order.discountAmount ?? 0)})
          </span>
        )}
        {!!order.shippingFee && <span className="text-xs text-slate-600">منها شحن {formatPrice(order.shippingFee)}</span>}
      </div>
    ),
    itemsDisplay: (
      <div className="flex flex-col gap-1">
        {/* طلب اشتراك (ملف 140): مالوش بنود — الشحنات في صفحة الاشتراك. */}
        {order.boxPlanId && (
          <span>
            اشتراك صندوق الرحلة
            {typeof (order.boxDetails?.plan as { name?: unknown } | undefined)?.name === 'string' &&
              ` — ${(order.boxDetails?.plan as { name: string }).name}`}
            {' · '}
            <a href="/account/subscriptions/box" className="font-bold text-rose-700 hover:underline">الشحنات</a>
          </span>
        )}
        {/* كان بيعرض رقم المنتج الداخلي («منتج (3f2a…)») بدل اسمه. ودلوقتي
            كل بند بنسخته ولمين **وإضافاته بأسعارها** (طلب تامر). */}
        <OrderLinesList lines={orderLines(order, names)} />
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
