import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getAllOrders } from '@/data/domains/orders';
import { getSiteSettings } from '@/data/domains/content';
import { createClient } from '@/lib/supabase/server';
import { cancelStalePendingOrders, cancelledMessage } from '@/lib/stale-orders';
import { notifyUser } from '@/lib/notifications';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { OrdersClient } from './OrdersClient';
import Link from 'next/link';

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

  const orders = await getAllOrders();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إدارة الطلبات" />
      <div className="mb-6 flex gap-4">
        <Link href="/dashboard/admin/orders" className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">طلبات المتجر</Link>
        <Link href="/dashboard/admin/orders/services" className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200">طلبات الخدمات (بداية الرحلة)</Link>
      </div>
      <OrdersClient initialOrders={orders} />
    </div>
  );
}
