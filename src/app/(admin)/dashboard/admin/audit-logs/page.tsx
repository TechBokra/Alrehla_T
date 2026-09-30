import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getAuditLogs } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canViewAuditLogs')) {
    return <Unauthorized />;
  }

  const logs = await getAuditLogs();
  
  const formatted = logs.map(l => ({
    ...l,
    idDisplay: <span className="font-mono text-xs text-slate-400">{l.id}</span>,
    dateDisplay: formatDate(l.createdAt),
  }));

  const columns = [
    { header: 'ID', accessorKey: 'idDisplay' },
    { header: 'التاريخ', accessorKey: 'dateDisplay' },
    { header: 'الإجراء', accessorKey: 'action' },
    { header: 'بواسطة', accessorKey: 'actorName' },
    { header: 'التفاصيل', accessorKey: 'entityType' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="سجلات النظام والتدقيق (Audit Logs)" />
      
      <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 flex items-center gap-2 border border-amber-200">
        هذه الصفحة للقراءة فقط. لا يمكن حذف أو تعديل أي من سجلات التدقيق.
      </div>
      
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
