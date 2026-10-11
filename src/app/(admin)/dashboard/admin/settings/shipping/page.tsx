import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getAllShippingRates } from '@/data/domains/orders';
import { hasAdminPermission } from '@/lib/utils';
import { ShippingRatesClient } from './ShippingRatesClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageOrders')) return <Unauthorized />;

  const rates = await getAllShippingRates();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="أسعار الشحن" />
      <p className="mb-6 text-slate-600">
        السعر الذي يُحسب للعميل في شاشة الدفع. الطلبات السابقة تحتفظ بالسعر الذي دُفع
        وقتها، فتعديل السعر هنا لا يغيّر طلبًا قائمًا.
      </p>
      <ShippingRatesClient rates={rates} />
    </div>
  );
}
