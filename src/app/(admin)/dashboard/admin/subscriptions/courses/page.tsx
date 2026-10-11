import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getParticipantName } from '@/data/domains/account';
import { getCurrentUser } from '@/data/domains/auth';
import { getCourseSubscriptions } from '@/data/domains/writing';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSubscriptions')) {
    return <Unauthorized />;
  }

  const allSubscriptions = await getCourseSubscriptions();
  
  const formatted = await Promise.all(allSubscriptions.map(async s => ({
    ...s,
    studentName: await getParticipantName(s.childId, s.userId),
    idDisplay: <span className="font-bold text-slate-700">#{s.id.split('-')[1]}</span>,
    dateDisplay: formatDate(s.startedAt),
    statusDisplay: (
      <StatusBadge 
        type={s.status === 'active' ? 'success' : s.status === 'completed' ? 'neutral' : 'warning'}
        label={s.status === 'active' ? 'نشط' : s.status === 'completed' ? 'مكتمل' : 'ملغى'}
      />
    ),
    packageDisplay: <span className="text-slate-600 font-medium">{s.packageId}</span>
  })));

  const columns = [
    { header: 'رقم الاشتراك', accessorKey: 'idDisplay' },
    { header: 'المشارك', accessorKey: 'studentName' },
    { header: 'الباقة', accessorKey: 'packageDisplay' },
    { header: 'تاريخ البدء', accessorKey: 'dateDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="اشتراكات الدورات متعددة الجلسات" />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
