import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getProviderPricingSettings } from '@/data/domains/(shared)/pricing/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { ProviderPricingClient } from './ProviderPricingClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!hasAdminPermission(await getCurrentUser(), 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const settings = await getProviderPricingSettings();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إعدادات تسعير مقدّمي الخدمات" />
      <p className="mb-6 text-slate-600">
        معادلة حساب سعر العميل من مستحق مقدّم الخدمة. منفصلة عن معادلة الجلسات —
        تغييرها مابيأثّرش على تسعير جلسات المدربين.
      </p>
      <ProviderPricingClient settings={settings} />
    </div>
  );
}
