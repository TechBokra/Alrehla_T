import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getAllOrders } from '@/data/domains/orders';
import { getManagedProducts } from '@/data/domains/products';
import { getSiteSettings } from '@/data/domains/content';
import { createClient } from '@/lib/supabase/server';
import { cancelStalePendingOrders, cancelledMessage } from '@/lib/stale-orders';
import { notifyUser } from '@/lib/notifications';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { OrdersClient } from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageOrders')) {
    return <Unauthorized />;
  }

  // ⚠️ احتياط للمهمة اليومية (`api/cron/stale-orders`): لو `CRON_SECRET`
  //    مش متظبط المهمة بتقف، فالإلغاء بيحصل هنا وقت ما الإدارة تفتح
  //    القايمة — قبل القراية، فالقايمة بتطلع بحالتها الصح.
  const { pendingOrderCancelDays: days } = await getSiteSettings();
  const stale = await cancelStalePendingOrders(await createClient(), days);
  if (stale.ok) {
    for (const o of stale.cancelled) {
      await notifyUser({
        event: 'order_status',
        recipientProfileId: o.userId,
        ...cancelledMessage(o, days),
        link: '/account/orders/enha-lak',
      });
    }
  }

  const [orders, products] = await Promise.all([getAllOrders(), getManagedProducts()]);
  // اسم كل منتج — عشان القايمة تقول الطلب فيه إيه ومخصّص لمين (ملاحظة تامر:
  // «طلبات التخصيص مرتبطة باسم المنتج»). كانت رقم طلب وتاريخ ومبلغ بس.
  const productNames = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      {/* طلبات الخدمات بقت في قسم «الخدمات الإبداعية» (`lib/admin-nav`). */}
      <DashboardPageHeader title="طلبات المنتجات" />
      <OrdersClient initialOrders={orders} productNames={productNames} />
    </div>
  );
}
