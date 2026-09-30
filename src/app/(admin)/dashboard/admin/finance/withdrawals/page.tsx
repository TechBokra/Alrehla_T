import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getWithdrawalRequests } from '@/data/domains/admin';
import { hasAdminPermission } from '@/lib/utils';
import { WithdrawalsClient } from './WithdrawalsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageFinance')) return <Unauthorized />;

  const requests = await getWithdrawalRequests();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات سحب أرباح المدربين" />
      <p className="mb-6 text-slate-600">
        التحويل يتم خارج الموقع. الحالة هنا سجلٌّ لقرار اتخذه شخص، لا عملية دفع تلقائية.
      </p>
      <WithdrawalsClient requests={requests} />
    </div>
  );
}
