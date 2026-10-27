import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getOrderableProviderCounts } from '@/data/domains/(shared)/services/queries';
import { getStandaloneServices } from '@/data/domains/(shared)/services/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { ServicesManagerClient } from './ServicesManagerClient';
import Link from 'next/link';
import { getOfferRequests } from '@/data/domains/(admin)/providers/offer-requests';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const canReviewOffers = hasAdminPermission(user, 'canManageInstructors');
  const [services, providerCounts, offerRequests] = await Promise.all([
    getStandaloneServices({ includeInactive: true }),
    getOrderableProviderCounts(),
    canReviewOffers ? getOfferRequests() : Promise.resolve([]),
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
      {offerRequests.length > 0 && (
        <Link
          href="/dashboard/admin/writing/services/requests"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900 hover:bg-blue-100"
        >
          <span>
            📥 {offerRequests.length} طلب تقديم خدمة مستني قرارك (جديد أو تعديل سعر)
          </span>
          <span>افتح الطلبات ←</span>
        </Link>
      )}
      <ServicesManagerClient services={services} providerCounts={providerCounts} />
    </div>
  );
}
