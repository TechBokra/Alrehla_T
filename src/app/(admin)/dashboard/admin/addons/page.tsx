import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getAddonProducts } from '@/data/domains/products';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { AddonsClient } from './AddonsClient';

export const dynamic = 'force-dynamic';

/**
 * إدارة الإضافات.
 *
 * الأسعار المكتوبة هنا هي اللي بتتحسب على العميل فعلًا: دالة إنشاء الطلب
 * في قاعدة البيانات بتقرا منها، والمتصفح ما بيبعتش أسعار.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const addons = await getAddonProducts({ includeInactive: true });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إضافات المنتجات" />

      <p className="mb-8 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
        دي اللمسات الاختيارية اللي العميل يقدر يضيفها لطلبه في خطوة التخصيص.
        السعر اللي هنا هو اللي بيتحسب عليه — الواجهة ما بتبعتش أسعار.
      </p>

      <AddonsClient addons={addons} />
    </div>
  );
}
