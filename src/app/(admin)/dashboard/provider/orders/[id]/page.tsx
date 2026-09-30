import { notFound, redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ServiceOrderDetail } from '@/components/services/ServiceOrderDetail';
import { getCurrentUser } from '@/data/domains/auth';
import { getMyProvider } from '@/data/domains/providers';
import { getServiceOrderDetail, getServiceOrderMessages } from '@/data/domains/services';

export const dynamic = 'force-dynamic';

/**
 * طلب واحد من ناحية مقدّم الخدمة.
 *
 * الفحص اللي تحت طبقة تانية: الحارس الحقيقي هو صلاحيات قاعدة البيانات —
 * اللي مش صاحب الطلب بيرجعله فاضي أصلًا من القاعدة، مش من هنا.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect('/sign-in');

  const provider = await getMyProvider();
  if (!provider) redirect('/dashboard');

  const order = await getServiceOrderDetail(id);
  if (!order || order.providerId !== provider.id) notFound();

  const messages = await getServiceOrderMessages(id);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title="تفاصيل الطلب" backHref="/dashboard/provider" />
      <ServiceOrderDetail
        order={order}
        messages={messages}
        viewer="instructor"
        currentProfileId={user.id}
      />
    </div>
  );
}
