import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getPublishers } from '@/data/domains/products';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const publishers = await getPublishers();
  const formatted = publishers.map(p => ({
    ...p,
    nameDisplay: <Link href={`/dashboard/admin/publishers/${p.id}`} className="font-bold text-blue-600 hover:underline">{p.name}</Link>
  }));

  const columns = [
    { header: 'الاسم', accessorKey: 'nameDisplay' },
    { header: 'الوصف', accessorKey: 'bio' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إدارة الناشرين" />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
