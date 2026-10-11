import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getOrders } from '@/data/domains/orders';
import { getSiteSettings } from '@/data/domains/content';
import { PayExistingOrder } from './PayExistingOrder';

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
  const [orders, settings] = await Promise.all([getOrders(), getSiteSettings()]);
  const order = orders.find((o) => o.id === id);
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="ادفع الطلب" backHref="/account/orders/enha-lak" />
      {order.status !== 'pending' ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-medium text-slate-700">
          الطلب ده مش مستني دفع — الإيصال اتبعت قبل كده أو الطلب اتقفل.{' '}
          <Link href="/account/orders/enha-lak" className="font-bold text-rose-700 hover:underline">
            ارجع لطلباتي
          </Link>
        </p>
      ) : (
        <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <PayExistingOrder
            orderId={order.id}
            reference={order.paymentReference ?? ''}
            amount={order.totalAmount}
            walletNumber={settings.paymentWalletNumber}
            qrUrl={settings.paymentQrUrl}
          />
        </div>
      )}
    </div>
  );
}
