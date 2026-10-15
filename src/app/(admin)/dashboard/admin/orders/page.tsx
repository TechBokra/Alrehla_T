import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminOrdersPageData } from '@/data/domains/(admin)/orders/page-data';
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
  // ⚠️ **كان `throw`**: شاشة «حدث خطأ غير متوقع» بلا كلمة، والرسالة
  //    العربية اللي الاستعلام كتبها بتتمسح في الإنتاج. الرسالة دي هي
  //    الفرق بين «الطلبات بايظة» و«إيه اللي ناقص بالظبط».
  if (!result.success) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <DashboardPageHeader title="طلبات المنتجات" />
        <div role="alert" className="space-y-2 rounded-3xl border border-red-200 bg-red-50 p-6">
          <p className="font-black text-red-900">تعذّر تحميل الطلبات</p>
          <p className="text-sm font-medium text-red-800">{result.error.message}</p>
        </div>
      </div>
    );
  }
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
