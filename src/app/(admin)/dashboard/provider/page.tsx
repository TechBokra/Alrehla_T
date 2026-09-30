import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getMyProvider, getServiceOrdersByProvider } from '@/data/domains/providers';
import { formatDate, formatPrice } from '@/lib/utils';
import { dueLabel, isOverdue, OPEN_SERVICE_STATUSES } from '@/lib/service-delivery';

export const dynamic = 'force-dynamic';

/**
 * لوحة مقدّم الخدمة.
 *
 * الصفحة دي بتشتغل لأي مقدّم — مدرب أو مستقل — عشان المستقل مش مدرب
 * وماينفعش يدخل لوحة المدربين. المدرب ليه لوحته الأصلية كمان، والاتنين
 * بيوصلوا لنفس الطلبات.
 */
const ORDER_STATUS: Record<string, { label: string; type: 'success' | 'warning' | 'neutral' }> = {
  pending: { label: 'بانتظار الدفع', type: 'warning' },
  awaiting_verification: { label: 'بانتظار تأكيد الدفع', type: 'warning' },
  paid: { label: 'مدفوع — ابدأ التنفيذ', type: 'success' },
  in_progress: { label: 'جاري التنفيذ', type: 'warning' },
  delivered: { label: 'تم التسليم', type: 'warning' },
  completed: { label: 'مكتمل', type: 'success' },
  refunded: { label: 'مسترجع', type: 'neutral' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

const STATUS_NOTE: Record<string, string> = {
  pending: 'حسابك تحت المراجعة — لن تصلك طلبات قبل تفعيله.',
  suspended: 'حسابك موقوف حاليًا. تواصل مع الإدارة.',
};

export default async function ProviderDashboard() {
  const provider = await getMyProvider();
  if (!provider) redirect('/dashboard');

  const orders = await getServiceOrdersByProvider(provider.id);

  const rows = orders.map((order) => ({
    ...order,
    idDisplay: (
      <Link
        href={`/dashboard/provider/orders/${order.id}`}
        className="font-mono text-xs font-bold text-blue-600 hover:underline"
      >
        #{order.id.slice(0, 8)}
      </Link>
    ),
    dateDisplay: formatDate(order.createdAt),
    amountDisplay:
      order.instructorEarning != null
        ? formatPrice(order.instructorEarning)
        : '—',
    dueDisplay: (OPEN_SERVICE_STATUSES as readonly string[]).includes(order.status) ? (
      <span
        className={`font-bold ${isOverdue(order.dueAt) ? 'text-red-600' : 'text-slate-600'}`}
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
    ),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title={`طلبات ${provider.displayName}`} />

      {STATUS_NOTE[provider.status] && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">
          {STATUS_NOTE[provider.status]}
        </p>
      )}

      <p className="text-sm font-medium text-slate-500">
        المبلغ المعروض هو مستحقك أنت، مش اللي دفعه العميل. مهلة التسليم الطبيعية
        14 يومًا من تأكيد الدفع، وأي تعديل عليها بيوصلك كإشعار.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">
          مفيش طلبات لسه.
        </p>
      ) : (
        <SimpleDataTable
          data={rows}
          columns={[
            { header: 'رقم الطلب', accessorKey: 'idDisplay' },
            { header: 'الخدمة', accessorKey: 'serviceName' },
            { header: 'التاريخ', accessorKey: 'dateDisplay' },
            { header: 'مستحقك', accessorKey: 'amountDisplay' },
            { header: 'المهلة', accessorKey: 'dueDisplay' },
            { header: 'الحالة', accessorKey: 'statusDisplay' },
          ]}
        />
      )}
    </div>
  );
}
