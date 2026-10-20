import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getOrders } from '@/data/domains/(client)/orders/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { PayExistingOrder } from './PayExistingOrder';
import { GatewayPayButton } from '@/components/checkout/GatewayPayButton';
import { getPaymentAvailability } from '@/data/domains/(shared)/payments/queries';

export const dynamic = 'force-dynamic';

/**
 * ادفع طلبًا متسجّل ومادفعش.
 *
 * ⚠️ **كان مفيش رجوع**: الطلب بيتسجّل **قبل** رفع الإيصال (عشان الرقم
 *    المرجعي يتولّد). فالعميل اللي قفل الصفحة بين الخطوتين كان طلبه
 *    بيفضل «بانتظار الدفع» للأبد، ومفيش أي شاشة يرفع منها الإيصال —
 *    كان لازم يطلب من الأول وطلب يفضل معلّق.
 *
 * `getOrders` بيقرا طلبات الداخل بس، فطلب حد تاني = «غير موجود».
 */
export default async function PayOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ⚠️ الصفحة دي كانت بتعرض نموذج التحويل اليدوي دايمًا — حتى والبوابة
  //    شغّالة. فالعميل اللي بيضغط «أكمل الدفع» كان بيتقاله «حوّل وارفع
  //    إيصال» بدل ما يتحوّل للبوابة.
  const [orders, settings, payment] = await Promise.all([
    getOrders(),
    getSiteSettings(),
    getPaymentAvailability(),
  ]);
  const order = orders.find((o) => o.id === id);
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="إتمام الدفع" backHref="/account/orders/enha-lak" />
      {order.status !== 'pending' && order.status !== 'failed' ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-medium text-slate-700">
          الطلب ده مش مستني دفع — اتدفع قبل كده أو اتقفل.{' '}
          <Link href="/account/orders/enha-lak" className="font-bold text-rose-700 hover:underline">
            ارجع لطلباتي
          </Link>
        </p>
      ) : (
        <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          {payment.mode === 'gateway' ? (
            <GatewayPayButton
              orderId={order.id}
              amount={order.totalAmount}
              methods={payment.methods}
              reference={order.paymentReference ?? ''}
            />
          ) : (
            <>
              {payment.notice && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  {payment.notice}
                </div>
              )}
              <PayExistingOrder
                orderId={order.id}
                reference={order.paymentReference ?? ''}
                amount={order.totalAmount}
                walletNumber={settings.paymentWalletNumber}
                qrUrl={settings.paymentQrUrl}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
