import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import { getCurrentUser } from '@/data/domains/auth';
import { getBoxSubscriptions } from '@/data/domains/subscriptions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; type: 'success' | 'warning' | 'neutral' }> = {
  active: { label: 'فعال', type: 'success' },
  paused: { label: 'موقوف مؤقتًا', type: 'warning' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

/**
 * The customer's box subscriptions.
 *
 * This page used to print one hard-coded row — "اشتراك 6 أشهر", next delivery
 * "15 نوفمبر 2023", status "فعال" — to every customer, whether or not they had
 * ever subscribed to anything.
 */
export default async function SubBoxPage() {
  const user = await getCurrentUser();
  const all = await getBoxSubscriptions();
  const mine = all.filter((sub) => sub.customerName === user.fullName);

  const data = mine.map((sub) => {
    const status = STATUS[sub.status] ?? { label: sub.status, type: 'neutral' as const };
    return {
      id: sub.id,
      name: sub.planName,
      date: sub.nextShipmentDate ? formatDate(sub.nextShipmentDate) : '—',
      statusDisplay: <StatusBadge type={status.type} label={status.label} />,
    };
  });

  const columns = [
    { header: 'نوع الاشتراك', accessorKey: 'name' },
    { header: 'تاريخ التسليم القادم', accessorKey: 'date' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
  ];

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="اشتراك صندوق الرحلة" />
      {data.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
          لا يوجد اشتراك في صندوق الرحلة على حسابك.
        </p>
      ) : (
        <SimpleDataTable columns={columns} data={data} />
      )}
    </div>
  );
}
