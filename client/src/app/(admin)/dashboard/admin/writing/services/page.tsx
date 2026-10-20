import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getOrderableProviderCounts } from '@/data/domains/(shared)/services/queries';
import { getStandaloneServices } from '@/data/domains/(shared)/services/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { ServicesManagerClient } from './ServicesManagerClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const [services, providerCounts] = await Promise.all([
    getStandaloneServices({ includeInactive: true }),
    getOrderableProviderCounts(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الخدمات الإبداعية المستقلة" />
      <p className="mb-6 text-slate-600">
        الخدمات التي تظهر للعملاء في صفحة الخدمات الإبداعية. التعديل هنا ينعكس على الموقع مباشرة.
      </p>
      <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
        ⚠️ الخدمة بتتطلب لما يكون فيه <strong>مقدّم خدمة مفعّل</strong> عارضها <strong>بسعر معتمد</strong> —
        من «مقدّمو الخدمات» أو من صفحة المدرب. من غير كده بتظهر للعميل «قريبًا» حتى لو مفعّلة هنا.
      </p>
      <ServicesManagerClient services={services} providerCounts={providerCounts} />
    </div>
  );
}
