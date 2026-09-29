import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity, AlertCircle, CheckCircle2, ArrowLeft, Package, ShoppingCart,
  Calendar, Users, Zap, FileText, History, Clock,
} from 'lucide-react';

import { getCurrentUser } from '@/data/domains/auth';
import { getReviewQueue } from '@/data/domains/review-queue';
import { getAllOrders } from '@/data/domains/orders';
import { getInstructors, getSessions, getWritingPackages } from '@/data/domains/writing';
import { getBlogPosts, getTestimonials, getSiteSettings } from '@/data/domains/content';
import { getAuditLogs } from '@/data/domains/admin';
import { createClient } from '@/lib/supabase/server';
import { SITE_IMAGE_SLOTS } from '@/lib/site-images';
import { hasAdminPermission, formatPrice, formatDate } from '@/lib/utils';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * اللوحة الرئيسية.
 *
 * كانت أربع كروت أرقام وجدولين — والأرقام كانت إجماليات من غير سياق،
 * والجدولين كانوا بيعرضوا **جزء من رقم المستخدم** في خانة الاسم.
 *
 * الترتيب دلوقتي بالأهمية: اللي محتاج قرار منك دلوقتي فوق، بعده اللي
 * النهارده، بعده الأرقام، بعدهم الاختصارات والملخصات والسجل.
 */
export default async function AdminDashboard() {
  const user = await getCurrentUser();

  if (user.role !== 'super_admin' && user.role !== 'general_supervisor') {
    redirect('/dashboard');
  }

  const [packages, orders, bookings, instructors, queueAll, posts, testimonials, settings] =
    await Promise.all([
      getWritingPackages(),
      getAllOrders(),
      getSessions(),
      getInstructors(),
      getReviewQueue(),
      getBlogPosts({ includeDrafts: true }),
      getTestimonials(),
      getSiteSettings(),
    ]);

  const reviewQueue = queueAll.filter((item) => hasAdminPermission(user, item.permission));
  const logs = hasAdminPermission(user, 'canViewAuditLogs') ? await getAuditLogs() : [];

  // ---------- أسماء أصحاب أحدث الطلبات ----------
  // قبل كده الجدول كان بيعرض جزء من رقم الحساب في خانة الاسم.
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const supabase = await createClient();
  const buyerIds = [...new Set(recentOrders.map((o) => o.userId))].filter(Boolean);
  const { data: buyers } = buyerIds.length
    ? await supabase.from('user_profiles').select('id, full_name').in('id', buyerIds)
    : { data: [] };
  const buyerNames = new Map((buyers ?? []).map((b) => [b.id, b.full_name]));

  // ---------- أجندة اليوم ----------
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const todaySessions = bookings
    .filter((s) => {
      const at = new Date(s.scheduledAt);
      return at >= startOfToday && at < endOfToday && s.status !== 'cancelled';
    })
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // جلسة معدّيها موعدها ولسه محدش قفلها — دي بتتنسي بسهولة.
  const overdueSessions = bookings.filter(
    (s) => new Date(s.scheduledAt) < now && s.status === 'confirmed'
  );

  // ---------- نظرة عامة ----------
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ordersThisWeek = orders.filter((o) => new Date(o.createdAt) >= weekAgo).length;
  const activePackages = packages.filter((p) => p.isActive).length;
  const urgentCount = reviewQueue.reduce((sum, i) => sum + i.count, 0);

  // ---------- ملخص المحتوى ----------
  const publishedPosts = posts.filter(
    (p) => new Date(p.publishedAt).getTime() <= now.getTime()
  ).length;
  const missingImages = SITE_IMAGE_SLOTS.filter(
    (slot) => !settings.images[slot.key as keyof typeof settings.images]
  );
  const packagesMissingDuration = packages.filter((p) => p.isActive && !p.sessionDuration);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <h1 className="mb-8 flex items-center gap-3 text-3xl font-black text-slate-900">
        <Activity className="h-8 w-8 text-amber-500" />
        لوحة تحكم الإدارة
      </h1>

      {/* ============ ١) مركز المهام العاجلة ============ */}
      <Block title="مركز المهام العاجلة" icon={AlertCircle}>
        {reviewQueue.length === 0 ? (
          <div className="flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            <p className="font-bold text-emerald-900">مفيش حاجة محتاجة قرار دلوقتي.</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="mb-5 font-black text-amber-900">{urgentCount} بند بانتظارك</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...reviewQueue]
                .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.count - a.count)
                .map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`group flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 transition-all hover:shadow-md ${
                      item.urgent
                        ? 'border-red-200 hover:border-red-400'
                        : 'border-slate-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-700">{item.label}</p>
                      <p
                        className={`mt-1 text-2xl font-black ${
                          item.urgent ? 'text-red-600' : 'text-slate-800'
                        }`}
                      >
                        {item.count}
                      </p>
                    </div>
                    <ArrowLeft className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-slate-500" />
                  </Link>
                ))}
            </div>
          </div>
        )}
      </Block>

      {/* ============ ٢) أجندة اليوم ============ */}
      <Block title="أجندة اليوم" icon={Clock}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title={`جلسات النهارده (${todaySessions.length})`}
            href="/dashboard/admin/bookings/calendar"
            linkLabel="التقويم"
          >
            {todaySessions.length === 0 ? (
              <Empty text="مفيش جلسات متسجّلة النهارده." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {todaySessions.slice(0, 6).map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                    <Link
                      href={`/dashboard/admin/bookings/${session.id}`}
                      className="truncate text-sm font-bold text-slate-700 hover:text-amber-600"
                    >
                      جلسة رقم {session.sessionNumber}
                    </Link>
                    <span className="shrink-0 font-mono text-sm font-bold text-slate-500">
                      {new Date(session.scheduledAt).toLocaleTimeString('ar-EG', { timeZone: PLATFORM_TIMEZONE,
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={`جلسات فاتت ولسه مفتوحة (${overdueSessions.length})`}
            href="/dashboard/admin/bookings"
            linkLabel="الحجوزات"
          >
            {overdueSessions.length === 0 ? (
              <Empty text="كل الجلسات اللي عدّت متقفلة." />
            ) : (
              <>
                <p className="mb-3 text-sm font-medium text-slate-500">
                  جلسة معدّيها موعدها ولسه حالتها «مؤكدة» — محتاجة تتقفل أو تتأجّل.
                </p>
                <ul className="divide-y divide-slate-100">
                  {overdueSessions.slice(0, 5).map((session) => (
                    <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                      <Link
                        href={`/dashboard/admin/bookings/${session.id}`}
                        className="truncate text-sm font-bold text-slate-700 hover:text-amber-600"
                      >
                        جلسة رقم {session.sessionNumber}
                      </Link>
                      <span className="shrink-0 text-sm font-bold text-red-600">
                        {formatDate(session.scheduledAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </Block>

      {/* ============ ٣) نظرة عامة ============ */}
      <Block title="نظرة عامة" icon={Activity}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Tile
            href="/dashboard/admin/orders"
            icon={ShoppingCart}
            color="text-blue-500"
            value={ordersThisWeek}
            label="طلبات آخر ٧ أيام"
          />
          <Tile
            href="/dashboard/admin/orders"
            icon={ShoppingCart}
            color="text-slate-500"
            value={orders.length}
            label="إجمالي الطلبات"
          />
          <Tile
            href="/dashboard/admin/bookings"
            icon={Calendar}
            color="text-indigo-500"
            value={bookings.length}
            label="إجمالي الحجوزات"
          />
          <Tile
            href="/dashboard/admin/writing/packages"
            icon={Package}
            color="text-amber-500"
            value={activePackages}
            label="باقات نشطة"
          />
          <Tile
            href="/dashboard/admin/instructors"
            icon={Users}
            color="text-emerald-500"
            value={instructors.length}
            label="المدربون"
          />
        </div>

        <Card
          title="أحدث الطلبات"
          href="/dashboard/admin/orders"
          linkLabel="عرض الكل"
          className="mt-6"
        >
          {recentOrders.length === 0 ? (
            <Empty text="مفيش طلبات لحد دلوقتي." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">الرقم المرجعي</th>
                    <th className="px-4 py-3 font-bold">العميل</th>
                    <th className="px-4 py-3 font-bold">المبلغ</th>
                    <th className="px-4 py-3 font-bold">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-bold text-slate-700">
                        <Link
                          href={`/dashboard/admin/orders/${order.id}`}
                          className="font-mono hover:text-blue-600 hover:underline"
                        >
                          {order.paymentReference ?? order.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-600">
                        {buyerNames.get(order.userId) ?? '—'}
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-600">
                        {formatPrice(order.totalAmount)}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-500">
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Block>

      {/* ============ ٤) إجراءات سريعة ============ */}
      <Block title="إجراءات سريعة" icon={Zap}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Action href="/dashboard/admin/content/blog/new" label="مقال جديد" permission="canManageContent" user={user} />
          <Action href="/dashboard/admin/writing/packages/new" label="باقة جديدة" permission="canManageCatalog" user={user} />
          <Action href="/dashboard/admin/products/new" label="منتج جديد" permission="canManagePublishers" user={user} />
          <Action href="/dashboard/admin/notifications/send" label="إرسال إشعار" permission="canManageContent" user={user} />
          <Action href="/dashboard/admin/content/settings" label="الإعدادات وشريط التنبيه" permission="canManageContent" user={user} />
          <Action href="/dashboard/admin/content/images" label="صور الموقع" permission="canManageContent" user={user} />
          <Action href="/dashboard/admin/settings/shipping" label="أسعار الشحن" permission="canManageOrders" user={user} />
          <Action href="/dashboard/admin/users" label="المستخدمون" permission="canManageUsers" user={user} />
        </div>
      </Block>

      {/* ============ ٥) ملخص المحتوى ============ */}
      {hasAdminPermission(user, 'canManageContent') && (
        <Block title="ملخص المحتوى" icon={FileText}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="اللي منشور" href="/dashboard/admin/content/blog" linkLabel="المدونة">
              <dl className="divide-y divide-slate-100 text-sm">
                <Row label="مقالات منشورة" value={`${publishedPosts}`} />
                <Row label="مقالات مجدولة أو مسودّة" value={`${posts.length - publishedPosts}`} />
                <Row label="آراء عملاء" value={`${testimonials.length}`} />
              </dl>
            </Card>

            <Card title="ناقص إدخال" href="/dashboard/admin/content/images" linkLabel="صور الموقع">
              {missingImages.length === 0 && packagesMissingDuration.length === 0 ? (
                <Empty text="مفيش حاجة ناقصة." />
              ) : (
                <ul className="space-y-2 text-sm font-medium text-slate-600">
                  {missingImages.length > 0 && (
                    <li className="rounded-xl bg-amber-50 p-3 text-amber-900">
                      {missingImages.length} خانة صور فاضية:{' '}
                      {missingImages.slice(0, 3).map((s) => s.label).join('، ')}
                      {missingImages.length > 3 ? '…' : ''}
                    </li>
                  )}
                  {packagesMissingDuration.length > 0 && (
                    <li className="rounded-xl bg-amber-50 p-3 text-amber-900">
                      {packagesMissingDuration.length} باقة نشطة بلا مدة جلسة:{' '}
                      {packagesMissingDuration.map((p) => p.name).join('، ')}
                    </li>
                  )}
                </ul>
              )}
            </Card>
          </div>
        </Block>
      )}

      {/* ============ ٦) أحدث الأنشطة ============ */}
      {hasAdminPermission(user, 'canViewAuditLogs') && (
        <Block title="أحدث الأنشطة" icon={History}>
          <Card
            title="آخر ما اتعمل في اللوحة"
            href="/dashboard/admin/audit-logs"
            linkLabel="السجل الكامل"
          >
            {logs.length === 0 ? (
              <Empty text="السجل فاضي." />
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {logs.slice(0, 8).map((log) => (
                  <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="font-bold text-slate-700">{log.action}</span>
                    <span className="font-medium text-slate-600">
                      {log.entityType} · {formatDate(log.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Block>
      )}
    </div>
  );
}

/* ---------------- أجزاء العرض ---------------- */

function Block({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-800">
        <Icon className="h-5 w-5 text-slate-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({
  title,
  href,
  linkLabel,
  className = '',
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-black text-slate-800">{title}</h3>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-bold text-blue-600 hover:underline">
            {linkLabel ?? 'عرض'}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Tile({
  href,
  icon: Icon,
  color,
  value,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
    >
      <Icon className={`mb-3 h-7 w-7 ${color} transition-transform group-hover:scale-110`} />
      <div className="text-3xl font-black text-slate-800">{value}</div>
      <div className="mt-1 text-sm font-bold text-slate-500">{label}</div>
    </Link>
  );
}

function Action({
  href,
  label,
  permission,
  user,
}: {
  href: string;
  label: string;
  permission: Parameters<typeof hasAdminPermission>[1];
  user: Parameters<typeof hasAdminPermission>[0];
}) {
  if (!hasAdminPermission(user, permission)) return null;
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-bold text-slate-700 transition-all hover:border-amber-300 hover:text-slate-900"
    >
      {label}
      <ArrowLeft className="h-4 w-4 shrink-0 text-slate-300" />
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="font-black text-slate-800">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm font-medium text-slate-600">{text}</p>;
}
