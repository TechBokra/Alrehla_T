import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getCourseSubscriptions } from '@/data/domains/(shared)/bookings/queries';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getPaymentAvailability } from '@/data/domains/(shared)/payments/queries';
import { GatewayPayButton } from '@/components/checkout/GatewayPayButton';
import { PayExistingBooking } from './PayExistingBooking';

export const dynamic = 'force-dynamic';

/**
 * ادفع حجزًا متسجّل ومادفعش.
 *
 * ── ليه الصفحة دي موجودة ────────────────────────────────────
 *
 * الحجز بيتسجّل **قبل** الدفع عشان ياخد رقمًا مرجعيًا. فاللي قفل
 * الصفحة بين الخطوتين كان حجزه بيفضل «بانتظار الدفع» للأبد **ومفيش
 * أي شاشة يكمّل منها** — زيّ ما كان الحال في «إنها لك» بالظبط قبل ما
 * تتعمل نظيرتها.
 *
 * ⚠️ **الملكية بتتفحص هنا صراحةً.** `getCourseSubscriptions` بترجّع
 *    حسب صلاحيات القاعدة، والاعتماد على ده وحده في صفحة بتاخد رقمًا
 *    من الرابط مش كفاية — فالمقارنة بـ`user.id` مكتوبة.
 */
export default async function PayBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, subscriptions, packages, settings, payment] = await Promise.all([
    getCurrentUser(),
    getCourseSubscriptions(),
    getWritingPackages(),
    getSiteSettings(),
    getPaymentAvailability(),
  ]);

  const booking = subscriptions.find((s) => s.id === id && s.userId === user.id);
  if (!booking) notFound();

  const pkg = packages.find((p) => p.id === booking.packageId);
  // المبلغ من القاعدة (بعد الخصم) هو المرجع؛ وسعر الباقة احتياطي
  // للحجوزات القديمة اللي اتعملت قبل ما المبلغ يتخزّن.
  const amount = booking.amount ?? pkg?.price ?? 0;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="إتمام الدفع" backHref="/account/subscriptions/course" />

      {booking.status !== 'pending' ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-medium text-slate-700">
          الحجز ده مش مستني دفع — اتدفع قبل كده أو اتقفل.{' '}
          <Link
            href="/account/subscriptions/course"
            className="font-bold text-emerald-700 hover:underline"
          >
            ارجع لباقاتي
          </Link>
        </p>
      ) : amount <= 0 ? (
        /* مبلغ غير محدد = حاجة ناقصة في الحجز نفسه. الدفع بصفر أو
           بمبلغ مخمَّن أسوأ من إننا نقول الحقيقة ونوجّهه للدعم. */
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center font-bold text-amber-900">
          مبلغ الحجز ده غير محدد — كلّمنا من{' '}
          <Link href="/support" className="underline">
            صفحة الدعم
          </Link>{' '}
          ونكمّله معاك.
        </p>
      ) : (
        <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <p className="font-black text-slate-900">{pkg?.name ?? 'باقة'}</p>
          </div>

          {payment.mode === 'gateway' ? (
            <GatewayPayButton
              orderId={booking.id}
              kind="course_subscription"
              label="رقم الحجز"
              amount={amount}
              methods={payment.methods}
              reference={booking.paymentReference ?? ''}
            />
          ) : (
            <>
              {payment.notice && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  {payment.notice}
                </div>
              )}
              <PayExistingBooking
                subscriptionId={booking.id}
                reference={booking.paymentReference ?? ''}
                amount={amount}
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
