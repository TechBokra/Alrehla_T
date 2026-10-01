import { notFound } from 'next/navigation';
import { productOrderStatus } from '@/lib/order-status';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getAllOrders } from '@/data/domains/orders';
import { getManagedProducts } from '@/data/domains/products';
import { hasAdminPermission, formatDate , formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { ConfirmPaymentButton } from '@/components/dashboard/ConfirmPaymentButton';
import { FulfilmentPanel } from './FulfilmentPanel';
import { OrderItemCustomization } from './OrderItemCustomization';
import { ElectronicDeliveryPanel } from './ElectronicDeliveryPanel';
import { BoxOrderPanel } from './BoxOrderPanel';
import { createClient } from '@/lib/supabase/server';
import { FORMAT_LABELS } from '@/lib/item-format';
import { PaymentReviewPanel } from '@/components/admin/PaymentReviewPanel';

export const dynamic = 'force-dynamic';

// الأسماء اتنقلت لـ`@/lib/order-status` (مصدر واحد للاسم واللون).

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageOrders')) {
    return <Unauthorized />;
  }
  const { id } = await params;
  const orders = await getAllOrders();
  const target = orders.find(o => o.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  const products = await getManagedProducts();
  const paid = ['paid', 'preparing', 'shipped', 'delivered'].includes(target.status);
  // طلب اشتراك (ملف 140): الاشتراك اللي اتعمل منه بعد الدفع، لو اتعمل.
  let boxSubscriptionId: string | undefined;
  if (target.boxPlanId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('box_subscriptions')
      .select('id')
      .eq('order_id', target.id)
      .maybeSingle();
    boxSubscriptionId = data?.id;
  }
  const formattedItems = target.items.map((item: any, idx: number) => {
    const product = products.find(p => p.id === item.productId);
    const price = item.unitPrice || (product ? product.price : 0);
    const quantity = item.quantity || 1;
    return {
      id: idx,
      nameDisplay: product ? product.name : item.productId,
      formatDisplay: FORMAT_LABELS[(item as { format?: keyof typeof FORMAT_LABELS }).format ?? 'printed'],
      priceDisplay: `${formatPrice(price)}`,
      quantity: quantity,
      totalDisplay: `${formatPrice(price * quantity)}`
    };
  });
  const columns = [
    { header: 'المنتج', accessorKey: 'nameDisplay' },
    { header: 'النسخة', accessorKey: 'formatDisplay' },
    { header: 'السعر', accessorKey: 'priceDisplay' },
    { header: 'الكمية', accessorKey: 'quantity' },
    { header: 'الإجمالي', accessorKey: 'totalDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`تفاصيل الطلب #${target.id.split('-')[1]}`} backHref="/dashboard/admin/orders" />
      
      <PaymentReviewPanel
        reference={target.paymentReference}
        amount={target.totalAmount}
        method={target.paymentMethod}
        receiptUrl={target.paymentReceiptUrl}
        legacyReference={target.transactionReference}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div>
            <div className="text-sm text-slate-500 mb-1">تاريخ الطلب: {formatDate(target.createdAt)}</div>
            <div className="text-sm text-slate-500 mb-1">حالة الطلب: {productOrderStatus(target.status).label}</div>
            {target.paymentReference && (
              <div dir="ltr" className="text-right font-mono text-sm font-bold text-blue-600">
                {target.paymentReference}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {target.status === 'awaiting_verification' && (
              <ConfirmPaymentButton kind="order" targetId={target.id} />
            )}
            {/* الاشتراك بيتشحن شهر شهر من صفحته — مش من هنا. */}
            {!target.boxPlanId && (
              <FulfilmentPanel
                orderId={target.id}
                status={target.status}
                trackingReference={target.trackingReference ?? ''}
              />
            )}
          </div>
        </div>
        {target.deliveryEmail && (
          <ElectronicDeliveryPanel
            orderId={target.id}
            email={target.deliveryEmail}
            sentAt={target.electronicSentAt}
            paid={paid}
          />
        )}

        {target.boxPlanId && (
          <BoxOrderPanel details={target.boxDetails} subscriptionId={boxSubscriptionId} paid={paid} />
        )}

        {/* The shipping address is now stored with the order — it used to be
            collected on screen and thrown away. */}
        <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <h3 className="mb-3 font-bold text-slate-800">عنوان الشحن</h3>
          {target.recipientName ? (
            <div className="space-y-1 text-sm font-medium text-slate-600">
              <p>
                <span className="font-bold text-slate-800">{target.recipientName}</span>
                {target.recipientPhone && (
                  <span className="mr-3" dir="ltr">
                    {target.recipientPhone}
                  </span>
                )}
              </p>
              <p>
                {target.addressLine}
                {target.city && `، ${target.city}`}
                {target.governorate && `، ${target.governorate}`}
              </p>
              {target.shippingNotes && <p className="text-slate-500">ملاحظات: {target.shippingNotes}</p>}
              {target.shippingFee != null && (
                <p className="text-slate-500">مصاريف الشحن: {formatPrice(target.shippingFee)}</p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-400">
              لا يوجد عنوان مسجّل — طلب قديم أو منتج لا يُشحن.
            </p>
          )}
          {target.trackingReference && (
            <p className="mt-3 text-sm font-bold text-blue-700" dir="ltr">
              {target.trackingReference}
            </p>
          )}
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-4">محتويات الطلب</h3>
        <SimpleDataTable columns={columns} data={formattedItems} />

        {/* اسم الطفل والقصة والصور والإضافات — كانت محفوظة ومش ظاهرة. */}
        <div className="mt-6 space-y-4">
          {target.items.map((item, idx) => (
            <OrderItemCustomization
              key={idx}
              productName={formattedItems[idx]?.nameDisplay ?? item.productId}
              customization={item.customizationData}
            />
          ))}
        </div>
        
        <div className="mt-6 border-t border-slate-100 pt-6 flex justify-end">
          <div className="text-2xl font-black text-slate-800">الإجمالي: {formatPrice(target.totalAmount)}</div>
        </div>
      </div>
    </div>
  );
}
