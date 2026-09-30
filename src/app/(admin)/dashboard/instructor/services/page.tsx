import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { MyServiceOffersClient } from './MyServiceOffersClient';
import { getPricingFormulaSettings } from '@/data/domains/writing';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatPrice } from '@/lib/utils';
import { getCurrentUser } from '@/data/domains/auth';
import { getSiteSettings } from '@/data/domains/content';
import {
  getMyInstructorId,
  getStandaloneServices,
  getInstructorServiceOffers,
  getServiceOrdersForInstructor,
} from '@/data/domains/services';

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

export default async function InstructorServicesPage() {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') {
    redirect('/dashboard');
  }

  const instructorId = await getMyInstructorId();

  if (!instructorId) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <DashboardPageHeader title="الخدمات الإبداعية" backHref="/dashboard/instructor" />
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-16 text-center">
          <p className="text-lg font-bold text-slate-500">
            لم يتم ربط حسابك بملف مدرب بعد.
          </p>
          <p className="mt-2 text-slate-400">تواصل مع الإدارة لاستكمال بياناتك.</p>
        </div>
      </div>
    );
  }

  const [services, offers, orders, formula, settings] = await Promise.all([
    getStandaloneServices(),
    getInstructorServiceOffers(instructorId),
    getServiceOrdersForInstructor(instructorId),
    getPricingFormulaSettings(),
    getSiteSettings(),
  ]);

  const orderRows = orders.map((order) => {
    const status = ORDER_STATUS[order.status] ?? { label: order.status, type: 'warning' as const };
    return {
      id: order.id,
      serviceName: (
        <Link
          href={`/dashboard/instructor/services/orders/${order.id}`}
          className="font-bold text-amber-600 hover:underline"
        >
          {order.serviceName}
        </Link>
      ),
      date: formatDate(order.createdAt),
      amount: formatPrice(order.amount),
      statusDisplay: <StatusBadge type={status.type} label={status.label} />,
    };
  });

  const orderColumns = [
    { header: 'الخدمة', accessorKey: 'serviceName' },
    { header: 'تاريخ الطلب', accessorKey: 'date' },
    { header: 'المبلغ', accessorKey: 'amount' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-12">
      <div>
        <DashboardPageHeader title="الخدمات التي تقدّمها" backHref="/dashboard/instructor" />
        <p className="mt-2 font-medium text-slate-500">
          اختر الخدمات التي تستطيع تقديمها واقترح حصيلتك من كل منها. الإدارة تعتمد السعر
          النهائي قبل أن تظهر الخدمة للعملاء.
        </p>
        <div className="mt-4">
          <MyServiceOffersClient
            services={services}
            offers={offers}
            formula={formula}
            priceAlert={settings.instructorPriceAlert}
          />
        </div>
      </div>

      <div>
        <DashboardPageHeader title="طلبات الخدمات" />
        <p className="mt-2 font-medium text-slate-500">الطلبات التي اختارك فيها العملاء.</p>
        <div className="mt-4">
          <SimpleDataTable columns={orderColumns} data={orderRows} />
        </div>
      </div>
    </div>
  );
}
