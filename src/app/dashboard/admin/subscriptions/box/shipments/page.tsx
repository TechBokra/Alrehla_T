import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getDueBoxShipments } from '@/data/domains/subscriptions';
import { hasAdminPermission } from '@/lib/utils';
import { DueShipmentsClient } from './DueShipmentsClient';

export const dynamic = 'force-dynamic';

/**
 * «صناديق الشهر» — كل اللي موعده جه أو هييجي قبل آخر الشهر، من كل
 * الاشتراكات النشطة، في قايمة واحدة لفريق التجهيز (`getDueBoxShipments`).
 * المتأخر بإطار أحمر وفوق.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSubscriptions')) return <Unauthorized />;
  const rows = await getDueBoxShipments();
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title="صناديق الشهر" backHref="/dashboard/admin/subscriptions/box" />
      <p className="text-sm text-slate-700">
        {rows.length === 0
          ? 'مفيش صناديق مستحقة الشهر ده.'
          : `${rows.length} صندوق مستحق لحد آخر الشهر${overdue ? ` — منهم ${overdue} متأخر` : ''}.`}
      </p>
      {rows.length > 0 && <DueShipmentsClient rows={rows} />}
    </div>
  );
}
