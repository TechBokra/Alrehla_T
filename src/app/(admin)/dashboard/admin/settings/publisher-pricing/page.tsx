import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getPublisherPricingSettings } from '@/data/domains/admin';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { PublisherPricingClient } from './PublisherPricingClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog') && !hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const settings = await getPublisherPricingSettings();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title="إعدادات تسعير الناشرين"
      />
      <p className="text-slate-600 mb-6">تعديل معادلة حساب الأسعار الخاصة بمنتجات الناشرين على المنصة.</p>
      <PublisherPricingClient settings={settings} />
    </div>
  );
}
