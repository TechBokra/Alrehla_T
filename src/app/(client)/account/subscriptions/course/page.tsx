import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { getCurrentUser } from '@/data/domains/auth';
import {
  getCourseSubscriptions,
  getWritingPackages,
  getSessions,
} from '@/data/domains/writing';

export const dynamic = 'force-dynamic';

/**
 * The customer's creative-writing packages.
 *
 * A single invented row — "مسار الإبداع التأسيسي، 3 من 8" — used to be shown
 * to every customer regardless of what they had bought.
 */
export default async function SubCoursePage() {
  const user = await getCurrentUser();
  const [subscriptions, packages, sessions] = await Promise.all([
    getCourseSubscriptions(),
    getWritingPackages(),
    getSessions(),
  ]);

  const mine = subscriptions.filter((sub) => sub.userId === user.id);

  const data = mine.map((sub) => {
    const pkg = packages.find((p) => p.id === sub.packageId);
    const own = sessions.filter((s) => s.courseSubscriptionId === sub.id);
    const done = own.filter((s) => s.status === 'completed').length;
    return {
      id: sub.id,
      name: pkg?.name ?? 'باقة غير معروفة',
      progress: own.length > 0 ? `${done} من ${own.length}` : 'لم تبدأ بعد',
    };
  });

  const columns = [
    { header: 'الباقة', accessorKey: 'name' },
    { header: 'الجلسة الحالية', accessorKey: 'progress' },
  ];

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="باقات بداية الرحلة" />
      {data.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
          لا توجد باقات على حسابك.
        </p>
      ) : (
        <SimpleDataTable columns={columns} data={data} />
      )}
    </div>
  );
}
