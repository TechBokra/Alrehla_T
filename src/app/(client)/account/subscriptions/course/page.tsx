import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getCourseSubscriptions } from '@/data/domains/(shared)/bookings/queries';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { getSessions } from '@/data/domains/(shared)/sessions/queries';
import { StatusBadge } from '@/components/StatusBadge';
import { PendingOrderActions } from '@/components/orders/PendingOrderActions';

/**
 * ⚠️ **الحالة ماكانتش بتتعرض خالص.** الحجز المعلّق (اللي ما اتدفعش)
 *    كان بيظهر «لم تبدأ بعد» زيّ المفعَّل اللي لسه ما بدأش — والعميل
 *    مش عارف إن فيه حاجة ناقصة منه، ومالوش طريقة يشيله.
 */
const BOOKING_STATUS: Record<
  string,
  { label: string; type: 'success' | 'warning' | 'neutral' | 'danger' | 'pending' }
> = {
  pending: { label: 'بانتظار الدفع', type: 'pending' },
  awaiting_verification: { label: 'بنراجع الدفع', type: 'warning' },
  active: { label: 'مفعَّل', type: 'success' },
  completed: { label: 'مكتمل', type: 'neutral' },
  cancelled: { label: 'ملغي', type: 'danger' },
};

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
    const view = BOOKING_STATUS[sub.status] ?? { label: sub.status, type: 'neutral' as const };
    return {
      id: sub.id,
      name: pkg?.name ?? 'باقة غير معروفة',
      progress: own.length > 0 ? `${done} من ${own.length}` : 'لم تبدأ بعد',
      statusDisplay: <StatusBadge type={view.type} label={view.label} />,
      // الحجز بيتسجّل قبل الدفع عشان ياخد رقمًا مرجعيًا، فكل محاولة ما
      // كملتش بتسيب حجزًا معلّقًا في الحساب. من غير إلغاء، بيفضل للأبد
      // (مفيش إلغاء تلقائي للحجوزات).
      //
      // ⚠️ من غير `payHref`: مفيش صفحة لإكمال دفع حجز قائم لسه. والطريق
      //    الطبيعي هنا إنه يلغي ويحجز من جديد — المعالج قصير، مش زيّ
      //    تخصيص قصة بصور وبيانات.
      actions:
        sub.status === 'pending' ? (
          <PendingOrderActions orderId={sub.id} kind="booking" gateway={false} />
        ) : null,
    };
  });

  const columns = [
    { header: 'الباقة', accessorKey: 'name' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
    { header: 'الجلسة الحالية', accessorKey: 'progress' },
    { header: '', accessorKey: 'actions' },
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
