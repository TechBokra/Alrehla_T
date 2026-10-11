import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getInstructorPayouts } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { getInstructors } from '@/data/domains/writing';
import { hasAdminPermission , formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageFinance')) {
    return <Unauthorized />;
  }

  const payouts = await getInstructorPayouts();
  const instructors = await getInstructors();
  
  const formatted = payouts.map(p => {
    const instructor = instructors.find(i => i.id === p.instructorId);
    return {
      ...p,
      instructorDisplay: instructor?.displayName || p.instructorId,
      idDisplay: <Link href={`/dashboard/admin/finance/instructor-payouts/${p.id}`} className="font-bold text-blue-600 hover:underline">#{p.id.split('-')[1]}</Link>,
      amountDisplay: `${formatPrice(p.amount)}`,
      periodDisplay: p.period,
      statusDisplay: p.status === 'paid'
        ? <StatusBadge type="success" label="مدفوع" />
        : <StatusBadge type="warning" label="معلق" />
    };
  });

  const columns = [
    { header: 'الرقم', accessorKey: 'idDisplay' },
    { header: 'المدرب', accessorKey: 'instructorDisplay' },
    { header: 'الفترة', accessorKey: 'periodDisplay' },
    { header: 'المبلغ', accessorKey: 'amountDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="مستحقات المدربين" />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
