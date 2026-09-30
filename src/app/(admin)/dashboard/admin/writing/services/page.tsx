import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getStandaloneServices } from '@/data/domains/services';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { ServicesManagerClient } from './ServicesManagerClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const services = await getStandaloneServices({ includeInactive: true });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الخدمات الإبداعية المستقلة" />
      <p className="mb-6 text-slate-600">
        الخدمات التي تظهر للعملاء في صفحة الخدمات الإبداعية. التعديل هنا ينعكس على الموقع مباشرة.
      </p>
      <ServicesManagerClient services={services} />
    </div>
  );
}
