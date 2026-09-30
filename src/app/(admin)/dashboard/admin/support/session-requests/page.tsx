import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getSupportSessionRequests } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSupport')) {
    return <Unauthorized />;
  }

  const requests = await getSupportSessionRequests();
  
  const formatted = requests.map(r => ({
    ...r,
    idDisplay: <span className="font-bold text-slate-700">#{r.id.split('-')[1]}</span>,
    dateDisplay: formatDate(r.createdAt),
    statusDisplay: (
      <StatusBadge
          type={r.status === 'contacted' ? 'success' : r.status === 'closed' ? 'neutral' : 'warning'}
          label={r.status === 'contacted' ? 'تم التواصل' : r.status === 'closed' ? 'مغلقة' : 'قيد الانتظار'}
        />
    )
  }));

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
    { header: 'الطالب', accessorKey: 'contactName' },
    { header: 'الموضوع', accessorKey: 'message' },
    { header: 'التاريخ', accessorKey: 'dateDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات الجلسات المخصصة" />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
