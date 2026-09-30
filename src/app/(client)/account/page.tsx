import Link from 'next/link';
import { Clock, PenTool, Calendar, ShieldCheck, ArrowLeft, Users, Package, KeyRound } from 'lucide-react';
import { getCurrentUser } from '@/data/domains/auth';
import { fetchFamilyMembers } from '@/app/actions/family';
import { getMyServiceOrders } from '@/data/domains/services';
import { getSessions } from '@/data/domains/writing';
import { formatDate } from '@/lib/utils';
import { formatCairo } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export default async function AccountOverviewPage() {
  const user = await getCurrentUser();
  const [familyMembers, serviceOrders, sessions] = await Promise.all([
    fetchFamilyMembers(),
    getMyServiceOrders(),
    getSessions(),
  ]);

  const openOrders = serviceOrders.filter(
    (o) => !['completed', 'refunded', 'cancelled'].includes(o.status)
  );

  const upcomingSession = sessions
    .filter((s) => s.status !== 'cancelled' && new Date(s.scheduledAt).getTime() >= Date.now() - 3600000)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

  const recent = serviceOrders.slice(0, 3);
  const firstName = (user.fullName || '').trim().split(/\s+/)[0] || '';

  return (
    <div className="space-y-8">
      {/* الترحيب وحالة الحساب */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
              {firstName ? `أهلاً بك، ${firstName}!` : 'أهلاً بك في حسابك!'}
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              هنا يمكنك إدارة جميع أنشطة وحجوزات واشتراكات عائلتك في منصة الرحلة.
            </p>
          </div>
          <Link
            href="/account/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors self-start sm:self-auto shadow-2xs"
          >
            <KeyRound className="h-4 w-4 text-slate-500" />
            <span>إعدادات الحساب والأمان</span>
          </Link>
        </div>
      </div>

      {/* تنبيه الجلسة القادمة إن وُجدت */}
      {upcomingSession && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 mb-1">
                جلستك القادمة القريبة
              </span>
              <h3 className="text-lg font-black text-emerald-950">
                {upcomingSession.packageName ? `جلسة في: ${upcomingSession.packageName}` : `جلسة ${upcomingSession.sessionNumber}`}
              </h3>
              <p className="text-xs text-emerald-800 font-medium mt-0.5">
                الموعد: {formatCairo(upcomingSession.scheduledAt, { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </div>
          </div>
          <Link
            href="/account/bookings"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 text-xs transition-colors shadow-xs"
          >
            <span>عرض كل الجلسات</span>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* شبكة الإحصائيات السريعة */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-800 font-bold text-xs mb-1">
              <Package className="h-4 w-4 text-blue-600" />
              <span>الطلبات النشطة</span>
            </div>
            <div className="text-3xl font-black text-blue-950 mt-2">{openOrders.length}</div>
          </div>
          <Link href="/account/orders/enha-lak" className="mt-4 text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1">
            <span>عرض الطلبات</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-800 font-bold text-xs mb-1">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>الجلسات والمواعيد</span>
            </div>
            <div className="text-3xl font-black text-indigo-950 mt-2">{sessions.length}</div>
          </div>
          <Link href="/account/bookings" className="mt-4 text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1">
            <span>جدول المواعيد</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
              <PenTool className="h-4 w-4 text-emerald-600" />
              <span>طلبات الخدمات الإبداعية</span>
            </div>
            <div className="text-3xl font-black text-emerald-950 mt-2">{serviceOrders.length}</div>
          </div>
          <Link href="/account/orders/creative-writing" className="mt-4 text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
            <span>متابعة الخدمات</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-800 font-bold text-xs mb-1">
              <Users className="h-4 w-4 text-violet-600" />
              <span>أفراد العائلة والأبناء</span>
            </div>
            <div className="text-3xl font-black text-violet-950 mt-2">{familyMembers.length}</div>
          </div>
          <Link href="/account/family" className="mt-4 text-xs font-bold text-violet-700 hover:text-violet-900 flex items-center gap-1">
            <span>إدارة العائلة</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* النشاط الأخير والروابط السريعة */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h2 className="text-lg font-black text-slate-800">أحدث طلبات الخدمات والأنشطة</h2>
            <Link href="/account/orders/creative-writing" className="text-xs font-bold text-slate-500 hover:text-slate-800">
              عرض الكل &larr;
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="py-8 text-center font-medium text-slate-400 text-sm">
              لا توجد طلبات حديثة حالياً.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/creative-writing/${order.id}`}
                  className="flex items-start gap-4 py-4 transition-colors hover:bg-slate-50 rounded-2xl px-2"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <PenTool className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-800 text-sm">{order.serviceName}</h4>
                      <span className="text-[11px] font-bold text-slate-400">
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
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-black text-slate-800">حسابك وأمانك</h2>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
              بيانات دخولك محمية وموثقة في المنصة. يمكنك تعديل ملفك الشخصي أو تغيير كلمة مرورك في أي وقت.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/account/settings"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-bold text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                  <span>تغيير كلمة المرور</span>
                </div>
                <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/account/family"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-bold text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>حسابات الأبناء والطلاب</span>
                </div>
                <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-6 text-[11px] text-slate-400 font-medium">
            لأي استفسار أو مساعدة، يمكنك فتح تذكرة عبر قسم الدعم الفني.
          </div>
        </div>
      </div>
    </div>
  );
}
