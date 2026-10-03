import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getBoxSubscriptions } from '@/data/domains/subscriptions';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSubscriptions')) {
    return <Unauthorized />;
  }

  const subscriptions = await getBoxSubscriptions();
  
  const formatted = subscriptions.map(s => {
    const shipped = s.shipments?.filter((x) => x.status === 'shipped' || x.status === 'delivered').length ?? 0;
    // الشحنة الجاية = أول شهر لسه ماتشحنش (ملف 140) — بدل تاريخ ثابت.
    const next = s.shipments?.find((x) => x.status === 'pending' || x.status === 'preparing');
    return {
      ...s,
      idDisplay: (
        <Link href={`/dashboard/admin/subscriptions/box/${s.id}`} className="font-bold text-blue-700 hover:underline">
          فتح
        </Link>
      ),
      progressDisplay: s.months ? `${shipped} / ${s.months}` : '—',
      nextDisplay: next
        ? `الشهر ${next.monthNumber}${next.status === 'preparing' ? ' (بيتجهّز)' : ''}`
        : s.months ? 'خلص' : (s.nextShipmentDate ? formatDate(s.nextShipmentDate) : '—'),
      statusDisplay: s.status === 'active'
        ? <StatusBadge type="success" label="نشط" />
        : s.status === 'paused'
        ? <StatusBadge type="warning" label="متوقف مؤقتاً" />
        : <StatusBadge type="danger" label="ملغى" />
    };
  });

  const columns = [
    { header: 'الاشتراك', accessorKey: 'idDisplay' },
    { header: 'المشترك', accessorKey: 'customerName' },
    { header: 'الخطة', accessorKey: 'planName' },
    { header: 'الشحنات', accessorKey: 'progressDisplay' },
    { header: 'الشحنة الجاية', accessorKey: 'nextDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      {/* «صناديق الشهر» و«الخطط» بقوا تبويبات فوق (`lib/admin-nav`). */}
      <DashboardPageHeader title="اشتراكات صندوق الرحلة" />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
