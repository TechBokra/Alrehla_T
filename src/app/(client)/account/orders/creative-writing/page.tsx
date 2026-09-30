import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';
import { formatDate, formatPrice } from '@/lib/utils';
import { getSessions } from '@/data/domains/writing';
import { getMyServiceOrders } from '@/data/domains/services';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const SERVICE_STATUS: Record<string, { label: string; type: 'success' | 'warning' | 'neutral' }> = {
  pending: { label: 'بانتظار الدفع', type: 'warning' },
  awaiting_verification: { label: 'بانتظار تأكيد الدفع', type: 'warning' },
  paid: { label: 'مدفوع', type: 'success' },
  in_progress: { label: 'جاري التنفيذ', type: 'warning' },
  delivered: { label: 'تم التسليم', type: 'warning' },
  completed: { label: 'مكتمل', type: 'success' },
  refunded: { label: 'مسترجع', type: 'neutral' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

const SESSION_STATUS: Record<string, { label: string; type: 'success' | 'warning' | 'neutral' }> = {
  confirmed: { label: 'مؤكد', type: 'success' },
  completed: { label: 'مكتمل', type: 'neutral' },
  scheduled: { label: 'مجدولة', type: 'warning' },
  cancelled: { label: 'ملغاة', type: 'neutral' },
};

export default async function CreativeWritingOrdersPage() {
  const [sessions, serviceOrders] = await Promise.all([
    getSessions(),
    getMyServiceOrders(),
  ]);

  const serviceRows = serviceOrders.map((order) => {
    const status = SERVICE_STATUS[order.status] ?? { label: order.status, type: 'warning' as const };
    return {
      id: order.id,
      serviceName: (
        <Link
          href={`/account/orders/creative-writing/${order.id}`}
          className="font-bold text-amber-600 hover:underline"
        >
          {order.serviceName}
        </Link>
      ),
      instructor: order.instructorName ?? '—',
      date: formatDate(order.createdAt),
      amount: formatPrice(order.amount),
      statusDisplay: <StatusBadge type={status.type} label={status.label} />,
    };
  });

  const serviceColumns = [
    { header: 'الخدمة', accessorKey: 'serviceName' },
    { header: 'المدرب', accessorKey: 'instructor' },
    { header: 'تاريخ الطلب', accessorKey: 'date' },
    { header: 'المبلغ', accessorKey: 'amount' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
  ];

  const sessionRows = sessions.map((session) => {
    const status = SESSION_STATUS[session.status] ?? { label: session.status, type: 'warning' as const };
    return {
      id: session.id,
      sessionNumber: session.sessionNumber,
      date: formatDate(session.scheduledAt),
      time: new Date(session.scheduledAt).toLocaleTimeString('ar-EG', { timeZone: PLATFORM_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
      }),
      statusDisplay: <StatusBadge type={status.type} label={status.label} />,
    };
  });

  const sessionColumns = [
    { header: 'رقم الجلسة', accessorKey: 'sessionNumber' },
    { header: 'التاريخ', accessorKey: 'date' },
    { header: 'الوقت', accessorKey: 'time' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
  ];

  return (
    <div className="space-y-10">
      <div>
        <DashboardPageHeader title="الخدمات الإبداعية" />
        <p className="mt-2 font-medium text-slate-500">طلباتك من الخدمات الإبداعية المنفردة.</p>
        <div className="mt-4">
          <SimpleDataTable columns={serviceColumns} data={serviceRows} />
        </div>
      </div>

      <div>
        <DashboardPageHeader title="الجلسات" />
        <p className="mt-2 font-medium text-slate-500">جلسات باقات الكتابة الإبداعية.</p>
        <div className="mt-4">
          <SimpleDataTable columns={sessionColumns} data={sessionRows} />
        </div>
      </div>
    </div>
  );
}
