import { formatPrice } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getMyOpenWithdrawalRequests } from '@/data/domains/(admin)/finance/queries';
import { getMyProviderPayouts } from '@/data/domains/(admin)/finance/provider-payouts';
import { ProviderPayoutsClient } from './ProviderPayoutsClient';

export const dynamic = 'force-dynamic';

/**
 * مستحقات مقدّم الخدمة المستقل.
 *
 * ⚠️ **الشاشة دي جديدة، والمستحقات نفسها كانت مش بتتسجّل.** لوحة
 *    المقدّم فيها عمود اسمه «مستحقك» من الأول — بس مفيش صف مستحق
 *    بيتعمل، ومفيش جدول ياخده، وطلب السحب كان بيرفض دوره صراحةً.
 *    يعني المنصة بتحصّل فلوسه وتعرضها عليه ومفيش طريق ياخدها.
 */
export default async function ProviderPayoutsPage() {
  const user = await getCurrentUser();
  // المدرب بيقدّم خدمات كمان، بس مستحقاته بتتجمع في شاشته هو.
  if (user.role !== 'service_provider') {
    redirect('/dashboard');
  }

  const payouts = await getMyProviderPayouts();
  const availableBalance = payouts
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const openRequests = await getMyOpenWithdrawalRequests();

  const data = payouts.map((p) => ({
    period: p.period,
    amount: formatPrice(p.amount),
    status:
      p.status === 'paid' ? (
        <StatusBadge type="success" label="تم التحويل" />
      ) : (
        <StatusBadge type="warning" label="قيد التجميع" />
      ),
  }));

  const columns = [
    { header: 'الفترة', accessorKey: 'period' },
    { header: 'المبلغ', accessorKey: 'amount' },
    { header: 'الحالة', accessorKey: 'status' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="مستحقاتك المالية" />

      <div className="mb-8">
        <ProviderPayoutsClient
          availableBalance={availableBalance}
          hasPendingRequest={openRequests > 0}
        />
      </div>

      <div className="mb-8 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p>
          مستحقك عن كل خدمة هو السعر المعتمد ليك — العميل بيدفع فوقه معادلة
          المنصة. وبيتسجّل <strong>لما الطلب يكتمل</strong>، لا عند الدفع.
          وبيانات التحويل بتتكتب مع كل طلب سحب، فمفيش حاجة محفوظة عندنا.
        </p>
      </div>

      <h3 className="mb-4 text-xl font-bold text-slate-800">سجل المستحقات</h3>
      {data.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
          لسه مفيش مستحقات. بيتسجّل مستحق أول ما طلب خدمة ليك يكتمل.
        </p>
      ) : (
        <SimpleDataTable columns={columns} data={data} />
      )}
    </div>
  );
}
