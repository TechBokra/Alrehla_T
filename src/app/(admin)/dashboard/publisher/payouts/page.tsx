import { formatPrice } from '@/lib/utils';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getPublisherPayouts } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { getMyOpenWithdrawalRequests } from '@/data/domains/admin';
import { PublisherPayoutsClient } from './PublisherPayoutsClient';

export const dynamic = 'force-dynamic';

export default async function PublisherPayoutsPage() {
  const user = await getCurrentUser();
  if (user.role !== 'publisher') {
    redirect('/dashboard');
  }

  const payouts = await getPublisherPayouts();
  const availableBalance = payouts
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  // ⚠️ الصلاحيات في القاعدة بتحصر الصفوف على الناشر نفسه، فالقايمة
  //    دي بتاعته هو. والقاعدة بترفض الطلب التاني بمحفّز (ملف 100)،
  //    فالشاشة بتقول قبل ما المستخدم يملا بيانات ويترفض.
  const openRequests = await getMyOpenWithdrawalRequests();

  const data = payouts.map(p => ({
    period: p.period,
    amount: `${formatPrice(p.amount)}`,
    status: p.status === 'paid' ? (
      <StatusBadge type="success" label="تم التحويل" />
    ) : (
      <StatusBadge type="warning" label="قيد التجميع" />
    )
  }));

  const columns = [
    { header: 'الفترة', accessorKey: 'period' },
    { header: 'المبلغ', accessorKey: 'amount' },
    { header: 'الحالة', accessorKey: 'status' }
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="المستحقات المالية (الناشر)" />

      <div className="mb-8">
        <PublisherPayoutsClient
          availableBalance={availableBalance}
          hasPendingRequest={openRequests > 0}
        />
      </div>

      <div className="rounded-xl bg-blue-50 p-4 border border-blue-100 text-sm text-blue-800 mb-8 flex gap-3">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p>
          نصيبك من كل نسخة هو الرقم اللي كتبته في المنتج، وبيتسجّل مستحقًّا
          **لما الطلب يتسلّم** — لا عند الدفع. وبيانات التحويل بتتكتب مع كل
          طلب سحب، فمفيش حاجة محفوظة عندنا.
        </p>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-4">سجل الدفعات</h3>
      <SimpleDataTable columns={columns} data={data} />
    </div>
  );
}
