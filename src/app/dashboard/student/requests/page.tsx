import Link from 'next/link';
import { getDependentRequests } from '@/data/domains/dependent-requests';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { getMyServiceOrders } from '@/data/domains/services';
import { getCourseSubscriptions, getWritingPackages } from '@/data/domains/writing';
import { getOrders } from '@/data/domains/orders';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';
import { formatCairo } from '@/lib/timezone';
import { formatDate, formatPrice } from '@/lib/utils';
import { Package, PenTool, ShoppingBag, ArrowLeft, ArrowUpRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const DEPENDENT_STATUS: Record<string, { label: string; type: StatusBadgeType }> = {
  pending: { label: 'في انتظار ولي الأمر', type: 'pending' },
  approved: { label: 'تمت الموافقة', type: 'success' },
  rejected: { label: 'مرفوض', type: 'danger' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

const ORDER_STATUS: Record<string, { label: string; type: StatusBadgeType }> = {
  pending: { label: 'قيد الانتظار', type: 'pending' },
  paid: { label: 'مكتمل الدفع', type: 'success' },
  in_progress: { label: 'قيد التنفيذ', type: 'pending' },
  delivered: { label: 'تم التسليم', type: 'success' },
  completed: { label: 'مكتمل', type: 'success' },
  cancelled: { label: 'ملغي', type: 'neutral' },
  active: { label: 'نشط', type: 'success' },
};

export default async function StudentRequestsPage() {
  const user = await getCurrentUser();
  const dependent = await getDependentGuardian(user.id);
  const isDependent = Boolean(dependent);

  // 1. حساب الطالب التابع لولي أمر
  if (isDependent) {
    const requests = await getDependentRequests();

    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="mb-2 text-2xl font-black text-slate-800">طلباتي من ولي الأمر</h1>
        <p className="mb-8 text-sm font-medium text-slate-500">
          اللي طلبته من ولي أمرك بيظهر هنا. لما يوافق، هو اللي بيكمّل الطلب
          والدفع من حسابه.
        </p>

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            لسه ما طلبتش حاجة. تقدر تطلب باقة أو خدمة من صفحتها، والطلب
            هيروح لولي أمرك.
          </div>
        ) : (
          <ul className="space-y-4">
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800">
                      {r.kind === 'name_change'
                        ? `يبقى اسمي: ${r.targetName}`
                        : r.targetName}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {r.kind === 'name_change'
                        ? 'تغيير الاسم'
                        : r.kind === 'package'
                          ? 'باقة تدريبية'
                          : 'خدمة إبداعية'}
                      {r.providerName ? ` · ${r.providerName}` : ''}
                    </p>
                  </div>
                  <StatusBadge
                    label={DEPENDENT_STATUS[r.status]?.label ?? r.status}
                    type={DEPENDENT_STATUS[r.status]?.type ?? 'neutral'}
                  />
                </div>

                {r.note && (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    <span className="font-bold">ملاحظتك: </span>
                    {r.note}
                  </p>
                )}

                {r.status === 'rejected' && r.guardianNote && (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    <span className="font-bold">رد ولي الأمر: </span>
                    {r.guardianNote}
                  </p>
                )}

                <p className="mt-3 text-xs font-medium text-slate-400">
                  أُرسل في {formatCairo(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // 2. حساب المستخدم الفردي (مستقل - ليس طفلاً تابعاً لولي أمر)
  const [serviceOrders, subscriptions, packages, orders] = await Promise.all([
    getMyServiceOrders(),
    getCourseSubscriptions(),
    getWritingPackages(),
    getOrders(),
  ]);

  const packageMap = new Map(packages.map((p) => [p.id, p.name]));
  const mySubscriptions = subscriptions.filter((s) => s.userId === user.id);
  const totalItemsCount = serviceOrders.length + mySubscriptions.length + orders.length;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-black text-slate-800">طلباتي واشتراكاتي</h1>
        <p className="text-sm font-medium text-slate-500">
          طلباتك واشتراكاتك المباشرة في منصة الرحلة. يمكنك متابعة حالة طلبات الخدمات والباقات وإدارتها من هنا.
        </p>
      </div>

      {totalItemsCount === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-bold text-slate-700 text-base mb-2">لا توجد طلبات أو اشتراكات حتى الآن.</p>
          <p className="text-sm font-medium text-slate-500 max-w-md mx-auto mb-6">
            يمكنك استكشاف الباقات التدريبية والخدمات الإبداعية، وطلبها مباشرة من حسابك.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/creative-writing/packages"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
            >
              <Package className="h-4 w-4" />
              <span>باقات الكتابة الإبداعية</span>
            </Link>
            <Link
              href="/creative-writing/services"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <PenTool className="h-4 w-4" />
              <span>الخدمات الإبداعية</span>
            </Link>
            <Link
              href="/enha-lak"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>متجر "إنها لك"</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* اشتراكات الباقات */}
          {mySubscriptions.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-800">
                <Package className="h-4 w-4 text-amber-500" />
                <span>باقات الكتابة الإبداعية ({mySubscriptions.length})</span>
              </h2>
              <ul className="space-y-3">
                {mySubscriptions.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                  >
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {packageMap.get(sub.packageId) ?? 'باقة كتابة إبداعية'}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        تاريخ البدء: {formatDate(sub.startedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge
                        label={ORDER_STATUS[sub.status]?.label ?? sub.status}
                        type={ORDER_STATUS[sub.status]?.type ?? 'neutral'}
                      />
                      <Link
                        href="/dashboard/student/sessions"
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                      >
                        <span>الجلسات</span>
                        <ArrowLeft className="h-3 w-3" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* طلبات الخدمات الإبداعية */}
          {serviceOrders.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-800">
                <PenTool className="h-4 w-4 text-emerald-500" />
                <span>طلبات الخدمات الإبداعية ({serviceOrders.length})</span>
              </h2>
              <ul className="space-y-3">
                {serviceOrders.map((ord) => (
                  <li
                    key={ord.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                  >
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {ord.serviceName}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        المقدّم: {ord.instructorName || ord.providerName || 'المنصة'} · {formatDate(ord.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {ord.amount != null && (
                        <span className="font-bold text-sm text-slate-800">
                          {formatPrice(ord.amount)}
                        </span>
                      )}
                      <StatusBadge
                        label={ORDER_STATUS[ord.status]?.label ?? ord.status}
                        type={ORDER_STATUS[ord.status]?.type ?? 'neutral'}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* طلبات المتجر */}
          {orders.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-800">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                <span>طلبات المتجر والمنتجات ({orders.length})</span>
              </h2>
              <ul className="space-y-3">
                {orders.map((ord) => (
                  <li
                    key={ord.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                  >
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        طلب رقم #{ord.id.slice(-6)}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {formatDate(ord.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-sm text-slate-800">
                        {formatPrice(ord.totalAmount)}
                      </span>
                      <StatusBadge
                        label={ORDER_STATUS[ord.status]?.label ?? ord.status}
                        type={ORDER_STATUS[ord.status]?.type ?? 'neutral'}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Link
              href="/creative-writing/services"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:underline"
            >
              <span>طلب خدمة أو باقة جديدة</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
