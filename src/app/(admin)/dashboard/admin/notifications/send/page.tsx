import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { NotificationsTabs } from '../NotificationsTabs';
import { SendForm } from './SendForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الإشعارات" />
      <NotificationsTabs />

      <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-bold text-slate-700">
          الإشعار بيظهر جوّه الموقع في جرس الإشعارات — مش إيميل ولا رسالة
          نصية. اللي مش داخل على الموقع مش هيشوفه دلوقتي.
        </p>
      </div>

      <SendForm />
    </div>
  );
}
