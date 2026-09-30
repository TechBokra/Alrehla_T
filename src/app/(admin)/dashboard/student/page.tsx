import { formatDate , formatPrice } from '@/lib/utils';
import { getCurrentUser } from '@/data/domains/auth';
import { getOrders } from '@/data/domains/orders';
import {
  getWritingPackages,
  getCourseSubscriptions,
  getSessions,
  getSessionReport,
} from '@/data/domains/writing';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Book, ShoppingBag, ArrowLeft, FileText, User, FileBox } from 'lucide-react';
import { StudentJourneyClient } from './StudentJourneyClient';

export const dynamic = 'force-dynamic';

export default async function StudentDashboard() {
  const user = await getCurrentUser();
  if (user.role !== 'student') {
    redirect('/dashboard');
  }

  // The dashboard used to show the first package in the whole catalogue as
  // "your course", whatever the student was actually enrolled in.
  const [packages, subscriptions, allSessions, orders] = await Promise.all([
    getWritingPackages(),
    getCourseSubscriptions(),
    getSessions(),
    getOrders(),
  ]);

  const mySubscription = subscriptions.find(
    (sub) => sub.userId === user.id && sub.status === 'active'
  );
  const currentPackage =
    packages.find((p) => p.id === mySubscription?.packageId) ?? null;
  const mySessions = mySubscription
    ? allSessions.filter((s) => s.courseSubscriptionId === mySubscription.id)
    : [];

  const lastCompleted = [...mySessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0];
  const latestReport = lastCompleted ? await getSessionReport(lastCompleted.id) : null;

  const getOrderStatus = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
            مكتمل الدفع
          </span>
        );
      case 'pending':
        return (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
            قيد الانتظار
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-black text-slate-900">
          مرحباً، {user.fullName}
        </h1>
        <div className="flex gap-3">
          <Link href="/dashboard/student/materials" className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
            <FileBox className="h-4 w-4" />
            المواد الدراسية
          </Link>
          <Link href="/dashboard/student/profile" className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
            <User className="h-4 w-4" />
            الملف الشخصي
          </Link>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* رحلتي الحالية */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
              <Book className="h-5 w-5 text-amber-500" />
              رحلتي الحالية
            </h2>
            <Link
              href="/dashboard/student/portfolio"
              className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline"
            >
              ملفي الكتابي
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          
          <StudentJourneyClient
            currentPackage={currentPackage}
            sessions={mySessions}
            latestReport={latestReport}
          />

          <Link
            href="/creative-writing/packages"
            className="mt-4 inline-block w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-center font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            استكشاف باقات أخرى
          </Link>
        </section>

        {/* طلبات إنها لك */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
              طلبات "إنها لك"
            </h2>
            <Link
              href="/enha-lak"
              className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline"
            >
              المتجر
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      طلب رقم #{order.id.split('-')[1]}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500">
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                  <div className="font-bold text-slate-700">
                    {formatPrice(order.totalAmount)}
                  </div>
                  {getOrderStatus(order.status)}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="py-8 text-center font-medium text-slate-500">
                لا توجد طلبات سابقة.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
