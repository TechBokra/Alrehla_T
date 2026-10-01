import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import { getMyBoxSubscriptions } from '@/data/domains/subscriptions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; type: 'success' | 'warning' | 'neutral' }> = {
  active: { label: 'فعال', type: 'success' },
  paused: { label: 'موقوف مؤقتًا', type: 'warning' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

const SHIP: Record<string, string> = {
  pending: 'لسه',
  preparing: 'بيتجهّز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
};

/**
 * اشتراكات العميل في صندوق الرحلة.
 *
 * ⚠️ كانت بتفلتر بالاسم (`customerName === user.fullName`) — دلوقتي
 *    بالحساب نفسه (`getMyBoxSubscriptions`). وبتعرض شحنة كل شهر (ملف 140).
 */
export default async function SubBoxPage() {
  const mine = await getMyBoxSubscriptions();

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="اشتراك صندوق الرحلة" />
      {mine.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <p className="font-medium text-slate-700">لا يوجد اشتراك في صندوق الرحلة على حسابك.</p>
          <p className="mt-2 text-sm text-slate-600">
            لو حوّلت واشتراكك مش ظاهر، بيظهر هنا أول ما الدفع يتأكد.
          </p>
          <Link href="/enha-lak/subscription" className="mt-4 inline-block font-bold text-rose-700 hover:underline">
            خطط صندوق الرحلة
          </Link>
        </div>
      ) : (
        mine.map((sub) => {
          const status = STATUS[sub.status] ?? { label: sub.status, type: 'neutral' as const };
          return (
            <section key={sub.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-900">{sub.planName}</h2>
                <StatusBadge type={status.type} label={status.label} />
              </div>
              {sub.endsAt && (
                <p className="mt-1 text-sm text-slate-700">لحد {formatDate(sub.endsAt)}</p>
              )}
              {(sub.addonDiscountPercent ?? 0) > 0 && sub.status === 'active' && (
                <p className="mt-1 text-sm font-bold text-emerald-800">
                  خصم {sub.addonDiscountPercent}٪ على الإضافات في أي طلب طول الاشتراك
                </p>
              )}
              {sub.shipments && sub.shipments.length > 0 && (
                <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                  {sub.shipments.map((s) => (
                    <li key={s.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <span className="font-bold">الشهر {s.monthNumber.toLocaleString('ar-EG')}</span>
                      {' — '}{SHIP[s.status]}
                      {s.trackingReference && (
                        <span className="block font-mono text-xs text-slate-700" dir="ltr">{s.trackingReference}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
