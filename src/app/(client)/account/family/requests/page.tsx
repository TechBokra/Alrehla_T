import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getDependentRequests } from '@/data/domains/dependent-requests';
import { RequestsClient } from './RequestsClient';

export const dynamic = 'force-dynamic';

export default async function DependentRequestsPage() {
  const requests = await getDependentRequests();

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="طلبات الأبناء" backHref="/account/family" />
      <p className="text-sm font-medium text-slate-500">
        لما ابنك يطلب باقة أو خدمة من حسابه، الطلب بييجي هنا. الموافقة بتوديك
        لشاشة الطلب بالبيانات جاهزة عشان تكمّل الدفع.
      </p>
      <RequestsClient requests={requests} />
    </div>
  );
}
