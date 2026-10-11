import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getBoxSubscription } from '@/data/domains/subscriptions';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { OrderItemCustomization } from '@/app/(admin)/dashboard/admin/orders/[id]/OrderItemCustomization';
import { ShipmentsClient, SubscriptionStatusControls } from './ShipmentsClient';
import { getActiveStoryGoals } from '@/data/domains/story-goals';
import { DEFAULT_GOALS } from '@/lib/story-goals';

export const dynamic = 'force-dynamic';

const STATUS = { active: 'نشط', paused: 'متوقف مؤقتًا', cancelled: 'ملغي' } as const;

/**
 * اشتراك واحد في صندوق الرحلة (ملف 140): بيانات الطفل وصوره، وشحنة كل
 * شهر بهدفها — اللي فريق التجهيز بيشتغل منه.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSubscriptions')) return <Unauthorized />;
  const { id } = await params;
  const sub = await getBoxSubscription(id);
  // نفس القايمة اللي العميل بيختار منها في معالج الصندوق.
  const activeGoals = await getActiveStoryGoals({ box: true });
  const goalLabels = (activeGoals.length ? activeGoals : DEFAULT_GOALS).map((g) => g.label);
  if (!sub) notFound();

  const done = sub.shipments?.filter((s) => s.status === 'delivered' || s.status === 'shipped').length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title={`${sub.planName} — ${sub.customerName}`} backHref="/dashboard/admin/subscriptions/box" />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <div className="space-y-1">
          <p><span className="font-bold">الحالة:</span> {STATUS[sub.status]}</p>
          {sub.startsAt && sub.endsAt && (
            <p><span className="font-bold">المدة:</span> {formatDate(sub.startsAt)} ← {formatDate(sub.endsAt)}</p>
          )}
          {sub.months && (
            <p><span className="font-bold">الشحنات:</span> {done.toLocaleString('ar-EG')} من {sub.months.toLocaleString('ar-EG')}</p>
          )}
          {(sub.addonDiscountPercent ?? 0) > 0 && (
            <p><span className="font-bold">خصم المشترك:</span> {sub.addonDiscountPercent}٪ على الإضافات</p>
          )}
          {sub.orderId && (
            <Link href={`/dashboard/admin/orders/${sub.orderId}`} className="font-bold text-blue-700 hover:underline">
              طلب الاشتراك والدفع ←
            </Link>
          )}
        </div>
        <SubscriptionStatusControls subscriptionId={sub.id} status={sub.status} />
      </div>

      <OrderItemCustomization productName="بيانات الطفل" customization={sub.details} />

      {sub.shipments && sub.shipments.length > 0 ? (
        <div>
        <ShipmentsClient shipments={sub.shipments} freeAddonName={sub.freeAddonName} goals={goalLabels} />
        <p className="mt-2 text-xs font-medium text-slate-600">
          الاختيارات من{' '}
          <Link href="/dashboard/admin/products/story-goals" className="font-bold underline">
            منتجات المنصة ← أهداف التخصيص
          </Link>{' '}
          (اللي معلّم عليها «صندوق الرحلة»).
        </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-700">
          اشتراك قديم من قبل نظام الشهور — مالوش شحنات مسجّلة.
        </p>
      )}
    </div>
  );
}
