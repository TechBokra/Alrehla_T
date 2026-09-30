import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getAllServiceOrders } from '@/data/domains/services';
import { hasAdminPermission , formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import Link from 'next/link';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { dueLabel, isOverdue, OPEN_SERVICE_STATUSES } from '@/lib/service-delivery';

export const dynamic = 'force-dynamic';

const ORDER_STATUS: Record<string, { label: string; type: 'success' | 'warning' | 'neutral' }> = {
  pending: { label: 'بانتظار الدفع', type: 'warning' },
  awaiting_verification: { label: 'بانتظار تأكيد الدفع', type: 'warning' },
  paid: { label: 'مدفوع', type: 'success' },
  in_progress: { label: 'جاري التنفيذ', type: 'warning' },
  delivered: { label: 'تم التسليم', type: 'warning' },
  completed: { label: 'مكتمل', type: 'success' },
  refunded: { label: 'مسترجع', type: 'neutral' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageOrders')) {
    return <Unauthorized />;
  }

  const orders = await getAllServiceOrders();

  const formatted = orders.map(order => ({
    ...order,
    idDisplay: (
      <Link
        href={`/dashboard/admin/orders/services/${order.id}`}
        className="font-mono text-xs font-bold text-blue-600 hover:underline"
      >
        #{order.id.slice(0, 8)}
      </Link>
    ),
    dateDisplay: formatDate(order.createdAt),
    amountDisplay: `${formatPrice(order.amount)}`,
    providerDisplay: order.providerName ?? '—',
    // المهلة بتهم بس وهو لسه مستنّي تسليم. طلب مكتمل أو ملغي مالوش معنى
    // إنه «متأخر».
    dueDisplay: (OPEN_SERVICE_STATUSES as readonly string[]).includes(order.status) ? (
      <span
        className={`font-bold ${
          isOverdue(order.dueAt) ? 'text-red-600' : 'text-slate-600'
        }`}
      >
        {dueLabel(order.dueAt)}
      </span>
    ) : (
      <span className="text-slate-300">—</span>
    ),
    statusDisplay: (
      <StatusBadge
        type={ORDER_STATUS[order.status]?.type ?? 'warning'}
        label={ORDER_STATUS[order.status]?.label ?? order.status}
      />
    )
  }));

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
    { header: 'معرّف المشتري', accessorKey: 'buyerProfileId' },
    { header: 'الخدمة', accessorKey: 'serviceName' },
    { header: 'مقدّم الخدمة', accessorKey: 'providerDisplay' },
    { header: 'تاريخ الدفع', accessorKey: 'dateDisplay' },
    { header: 'المبلغ الإجمالي', accessorKey: 'amountDisplay' },
    { header: 'المهلة', accessorKey: 'dueDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إدارة الطلبات" />
      <div className="mb-6 flex gap-4">
        <Link href="/dashboard/admin/orders" className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200">طلبات المتجر</Link>
        <Link href="/dashboard/admin/orders/services" className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">طلبات الخدمات (بداية الرحلة)</Link>
      </div>
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
