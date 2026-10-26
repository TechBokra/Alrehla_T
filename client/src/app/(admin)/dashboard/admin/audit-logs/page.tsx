import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import Link from 'next/link';
import { getAuditLogs } from '@/data/domains/(admin)/audit/queries';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canViewAuditLogs')) {
    return <Unauthorized />;
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const { logs, hasNext } = await getAuditLogs(page);
  
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

      <nav aria-label="صفحات السجل" className="mt-6 flex items-center justify-between gap-3">
        {page > 1 ? (
          <Link href={`?page=${page - 1}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            → الأحدث
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm font-bold text-slate-500">صفحة {page.toLocaleString('ar-EG')}</span>
        {hasNext ? (
          <Link href={`?page=${page + 1}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            الأقدم ←
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
