import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getAdminOrdersPageData } from '@/data/domains/admin-orders-page';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { OrdersClient } from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageOrders')) {
    return <Unauthorized />;
  }

  const result = await getAdminOrdersPageData();
  if (!result.success) throw new Error(result.error.message);
  const { orders, productNames, productCategories, customerNames } = result.data;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      {/* طلبات الخدمات بقت في قسم «الخدمات الإبداعية» (`lib/admin-nav`). */}
      <DashboardPageHeader title="طلبات المنتجات" />
      <OrdersClient
        initialOrders={orders}
        productNames={productNames}
        productCategories={productCategories}
        customerNames={customerNames}
      />
    </div>
  );
}
