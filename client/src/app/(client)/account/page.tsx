import Link from 'next/link';
import {
  Clock,
  PenTool,
  Calendar,
  ShieldCheck,
  ArrowLeft,
  Users,
  Package,
  KeyRound,
} from 'lucide-react';
import { getAccountOverviewData } from '@/data/domains/(client)/account/overview';
import { FormError } from '@/components/ui/FormError';
import { formatDate } from '@/lib/utils';
import { formatCairo } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export default async function AccountOverviewPage() {
  const result = await getAccountOverviewData();
  if (!result.success) return <FormError message={result.error.message} />;
  const {
    user,
    familyMembers,
    serviceOrders,
    sessions,
    openOrders,
    upcomingSession,
    recent,
    firstName,
  } = result.data;

  return (
    <div className="space-y-8">
      {/* الترحيب وحالة الحساب */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-800 sm:text-3xl">
              {firstName ? `أهلاً بك، ${firstName}!` : 'أهلاً بك في حسابك!'}
            </h1>
            {/* نوع الحساب ظاهر (ملاحظة تامر): الفرد غير ولي الأمر — وحساب
                الطالب التابع ليه مساحته لوحده (`/dashboard/student`). */}
            <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {user.isGuardian ? 'حساب ولي أمر' : 'حساب مستخدم'}
            </span>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {user.isGuardian
                ? 'هنا تتابع طلبات وحجوزات واشتراكات عائلتك.'
                : 'هنا تتابع طلباتك وحجوزاتك واشتراكاتك. ولو عايز تحجز لأولادك، ضيفهم من «أفراد العائلة».'}
            </p>
          </div>
          <Link
            href="/account/settings"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 sm:self-auto"
          >
            <KeyRound className="h-4 w-4 text-slate-500" />
            <span>إعدادات الحساب والأمان</span>
          </Link>
        </div>
      </div>

      {/* تنبيه الجلسة القادمة إن وُجدت */}
      {upcomingSession && (
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-xs md:flex-row md:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="mb-1 inline-block rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                جلستك القادمة القريبة
              </span>
              <h3 className="text-lg font-black text-emerald-950">
                {upcomingSession.packageName
                  ? `جلسة في: ${upcomingSession.packageName}`
                  : `جلسة ${upcomingSession.sessionNumber}`}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-emerald-800">
                الموعد:{' '}
                {formatCairo(upcomingSession.scheduledAt, {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          </div>
          <Link
            href="/account/bookings"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
          >
            <span>عرض كل الجلسات</span>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* شبكة الإحصائيات السريعة */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-800">
              <Package className="h-4 w-4 text-blue-600" />
              <span>الطلبات النشطة</span>
            </div>
            <div className="mt-2 text-3xl font-black text-blue-950">
              {openOrders.length}
            </div>
          </div>
          <Link
            href="/account/orders/enha-lak"
            className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
          >
            <span>عرض الطلبات</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-indigo-800">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>الجلسات والمواعيد</span>
            </div>
            <div className="mt-2 text-3xl font-black text-indigo-950">
              {sessions.length}
            </div>
          </div>
          <Link
            href="/account/bookings"
            className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900"
          >
            <span>جدول المواعيد</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-emerald-800">
              <PenTool className="h-4 w-4 text-emerald-600" />
              <span>طلبات الخدمات الإبداعية</span>
            </div>
            <div className="mt-2 text-3xl font-black text-emerald-950">
              {serviceOrders.length}
            </div>
          </div>
          <Link
            href="/account/orders/creative-writing"
            className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
          >
            <span>متابعة الخدمات</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-violet-100 bg-violet-50/70 p-5 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-violet-800">
              <Users className="h-4 w-4 text-violet-600" />
              <span>أفراد العائلة والأبناء</span>
            </div>
            <div className="mt-2 text-3xl font-black text-violet-950">
              {familyMembers.length}
            </div>
          </div>
          <Link
            href="/account/family"
            className="mt-4 flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900"
          >
            <span>إدارة العائلة</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* النشاط الأخير والروابط السريعة */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-800">
              أحدث طلبات الخدمات والأنشطة
            </h2>
            <Link
              href="/account/orders/creative-writing"
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              عرض الكل &larr;
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-400">
              لا توجد طلبات حديثة حالياً.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/creative-writing/${order.id}`}
                  className="flex items-start gap-4 rounded-2xl px-2 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <PenTool className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-800">
                        {order.serviceName}
                      </h4>
                      <span className="text-xs font-bold text-slate-400">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    {order.instructorName && (
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        المدرب: {order.instructorName}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* كارت اختصارات الحساب والأمان */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div>
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-black text-slate-800">
                حسابك وأمانك
              </h2>
            </div>
            <p className="mb-4 text-xs leading-relaxed font-medium text-slate-600">
              بيانات دخولك محمية وموثقة في المنصة. يمكنك تعديل ملفك الشخصي أو
              تغيير كلمة مرورك في أي وقت.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/account/settings"
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                  <span>تغيير كلمة المرور</span>
                </div>
                <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/account/family"
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>حسابات الأبناء والطلاب</span>
                </div>
                <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 text-xs font-medium text-slate-400">
            لأي استفسار أو مساعدة، يمكنك فتح تذكرة عبر قسم الدعم الفني.
          </div>
        </div>
      </div>
    </div>
  );
}
