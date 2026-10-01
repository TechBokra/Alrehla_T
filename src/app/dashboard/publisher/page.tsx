import { formatPrice } from '@/lib/utils';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { BookOpen, DollarSign, ShoppingBag, Star, User } from 'lucide-react';
import { getCurrentUser } from '@/data/domains/auth';
import { getPublisherOrders } from '@/data/domains/products';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { salesTotals } from '@/lib/publisher-sales';
import { StatusBadge } from '@/components/StatusBadge';
import { productOrderStatus } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

export default async function PublisherDashboard() {
  const user = await getCurrentUser();
  if (user.role !== 'publisher') {
    redirect('/dashboard');
  }

  const orders = await getPublisherOrders();
  
  // ⚠️ كانت بتجمع **كل** البنود — طلب بانتظار الدفع أو ملغي كان بيتحسب
  //    في «أرباحك». دلوقتي المدفوع بس (`salesTotals`).
  const { sales: totalSales, earnings: totalEarnings } = salesTotals(orders);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`مرحباً، ${user.fullName} (ناشر)`} />

      {/* Quick Links */}
      <div className="flex flex-wrap gap-4 mb-8">
        <Link href="/dashboard/publisher/products" className="flex items-center gap-2 rounded-xl bg-amber-50 px-5 py-3 font-bold text-amber-700 border border-amber-200 transition-colors hover:bg-amber-100">
          <BookOpen className="h-5 w-5" />
          إدارة منتجاتي (مكتبة إنها لك)
        </Link>
        <Link href="/dashboard/publisher/orders" className="flex items-center gap-2 rounded-xl bg-sky-50 px-5 py-3 font-bold text-sky-700 border border-sky-200 transition-colors hover:bg-sky-100">
          <ShoppingBag className="h-5 w-5" />
          طلباتي
        </Link>
        <Link href="/dashboard/publisher/profile" className="flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700 border border-slate-200 transition-colors hover:bg-slate-200">
          <User className="h-5 w-5" />
          الملف الشخصي
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* "+12% عن الشهر الماضي", a 70% share, "12 كتاب", "4.8/5 من 156 تقييم"
            and a withdrawable balance of 850 were all written into the page —
            the same figures for every publisher, none of them measured. */}
        <StatCard title="المبيعات المدفوعة" value={`${formatPrice(totalSales)}`} icon={ShoppingBag} />
        <StatCard title="أرباحك من المدفوع" value={`${formatPrice(totalEarnings)}`} icon={DollarSign} />
        <StatCard title="عدد الطلبات" value={`${orders.length}`} icon={BookOpen} />
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-6">أحدث المبيعات</h3>
          <div className="overflow-x-auto">
            {/* ⚠️ **خمسة أعمدة على شاشة 375 بكسل** — «إجمالي البيع»
                و«أرباحك» كانا بره الشاشة، وهما أهم عمودين للناشر.
                `SimpleDataTable` فيه عرض بطاقات جاهز.

                ⚠️ و`text-emerald-600` على أبيض = **3.60:1** وبيسقط
                   في المعيار (المطلوب 4.5). بقى 700. */}
            <SimpleDataTable
              searchPlaceholder="ابحث باسم المنتج…"
              emptyMessage="مفيش مبيعات لسه."
              columns={[
                { header: 'المنتج', accessorKey: 'productName' },
                { header: 'التاريخ', accessorKey: 'date' },
                { header: 'الكمية', accessorKey: 'quantity' },
                { header: 'إجمالي البيع', accessorKey: 'total' },
                { header: 'أرباحك', accessorKey: 'shareDisplay' },
                { header: 'الحالة', accessorKey: 'statusDisplay' },
              ]}
              data={orders.map((order) => ({
                productName: order.productName,
                date: new Date(order.createdAt).toLocaleDateString('ar-EG', {
                  timeZone: PLATFORM_TIMEZONE,
                }),
                quantity: order.quantity,
                total: formatPrice(order.totalAmount),
                shareDisplay: (
                  <span className="font-bold text-emerald-700">
                    {formatPrice(order.publisherShare)}
                  </span>
                ),
                statusDisplay: (
                  <StatusBadge
                    type={productOrderStatus(order.status).type}
                    label={productOrderStatus(order.status).label}
                  />
                ),
              }))}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">طلب سحب الأرباح</h3>
            <p className="mb-6 text-sm text-slate-400">
              لطلب سحب أرباحك، تواصل مع الإدارة. طلب السحب من داخل الموقع غير متاح بعد.
            </p>

            <div className="mb-8">
              <div className="mb-1 text-sm text-slate-400">إجمالي أرباحك حتى الآن</div>
              <div className="text-4xl font-black text-emerald-400">
                {formatPrice(totalEarnings)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
