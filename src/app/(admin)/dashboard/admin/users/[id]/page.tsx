import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getAllUsers, getCurrentUser, getAdminRoles } from '@/data/domains/(shared)/auth/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { createClient } from '@/lib/supabase/server';
import { getAdminUserAuthData } from '@/data/domains/(admin)/users/auth';
import { getChildrenAgeData } from '@/data/domains/(admin)/dashboard/timing';
import {
  AdminUserDetailClient,
  type UserOrderRow,
  type UserServiceOrderRow,
  type UserSessionRow,
  type UserChildRow,
  type UserTicketRow,
} from './AdminUserDetailClient';
import { SuspensionPanel } from './SuspensionPanel';
import { DeleteAccountPanel } from './DeleteAccountPanel';
import { getAccountActivity } from '@/actions/admin-users';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageUsers')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const [allUsers, adminRoles] = await Promise.all([getAllUsers(), getAdminRoles()]);
  const targetUser = allUsers.find((u) => u.id === id);
  if (!targetUser) notFound();

  const { accountEmail, loginBlocked } = await getAdminUserAuthData(id, targetUser.email || '');

  const supabase = await createClient();

  // 1. طلبات المتجر / المنتجات
  const { data: rawOrders } = await supabase
    .from('orders')
    .select('id, total_amount, status, created_at, payment_method, tracking_reference, order_items(id)')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  const orders: UserOrderRow[] = (rawOrders || []).map((o: any) => ({
    id: o.id,
    totalAmount: Number(o.total_amount || 0),
    status: o.status,
    createdAt: o.created_at,
    paymentMethod: o.payment_method || undefined,
    trackingReference: o.tracking_reference || undefined,
    itemsCount: Array.isArray(o.order_items) ? o.order_items.length : 0,
  }));

  // 2. طلبات الخدمات الإبداعية
  const { data: rawServiceOrders } = await supabase
    .from('service_orders')
    .select('id, amount, status, created_at, standalone_services(name), instructors(display_name)')
    .eq('buyer_profile_id', id)
    .order('created_at', { ascending: false });

  const serviceOrders: UserServiceOrderRow[] = (rawServiceOrders || []).map((so: any) => ({
    id: so.id,
    serviceName: so.standalone_services?.name || 'خدمة إبداعية',
    instructorName: so.instructors?.display_name || undefined,
    amount: Number(so.amount || 0),
    status: so.status,
    createdAt: so.created_at,
  }));

  // 3. اشتراكات ومواعيد الجلسات
  const { data: subs } = await supabase
    .from('course_subscriptions')
    .select('id, package_id, creative_writing_packages(name)')
    .eq('user_id', id);

  const subIds = (subs || []).map((s: any) => s.id);
  let sessions: UserSessionRow[] = [];
  if (subIds.length > 0) {
    const { data: rawSessions } = await supabase
      .from('sessions')
      .select('id, session_number, scheduled_at, status, course_subscription_id, instructors(display_name)')
      .in('course_subscription_id', subIds)
      .order('scheduled_at', { ascending: false });

    const pkgMap = new Map((subs || []).map((s: any) => [s.id, s.creative_writing_packages?.name]));
    sessions = (rawSessions || []).map((s: any) => ({
      id: s.id,
      sessionNumber: s.session_number,
      scheduledAt: s.scheduled_at,
      status: s.status,
      packageName: pkgMap.get(s.course_subscription_id) || 'باقة تدريبية',
      instructorName: s.instructors?.display_name || undefined,
    }));
  }

  // 4. أفراد العائلة والأبناء
  const { data: childrenData } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('user_profile_id', id)
    .order('created_at', { ascending: true });

  const childrenWithAge = await getChildrenAgeData(childrenData || []);
  const childrenList: UserChildRow[] = childrenWithAge.map((c) => ({
    id: c.id,
    fullName: c.full_name,
    birthDate: c.birth_date ?? undefined,
    age: c.age,
    createdAt: c.created_at,
  }));

  // 5. تذاكر الدعم الفني
  const { data: rawTickets } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  const tickets: UserTicketRow[] = (rawTickets || []).map((t: any) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.created_at,
  }));

  const isAdminAccount = targetUser.role === 'super_admin' || targetUser.role === 'general_supervisor';
  // الحذف لمدير النظام بس، ومابيتعملش على حساب إداري ولا على نفسك.
  const canDelete = user.role === 'super_admin' && !isAdminAccount && targetUser.id !== user.id;
  const [activity, { data: openRequest }] = await Promise.all([
    canDelete ? getAccountActivity(id) : Promise.resolve(null),
    supabase
      .from('account_deletion_requests')
      .select('reason, created_at')
      .eq('user_id', id)
      .eq('status', 'pending')
      .maybeSingle(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <DashboardPageHeader
        title={`ملف المستخدم: ${targetUser.fullName}`}
        backHref="/dashboard/admin/users"
      />

      {/* ⚠️ الإيقاف بيمنع الشراء لا الدخول — الشاشة بتسرد المسموح
          والممنوع بدل ما تسمّي الإجراء وخلاص. */}
      {!targetUser.archivedAt && (
        <SuspensionPanel
          userId={targetUser.id}
          fullName={targetUser.fullName}
          suspendedAt={targetUser.suspendedAt}
          suspensionReason={targetUser.suspensionReason}
          isAdminAccount={isAdminAccount}
          loginBlocked={loginBlocked}
        />
      )}

      {canDelete ? (
        <DeleteAccountPanel
          userId={targetUser.id}
          fullName={targetUser.fullName}
          activity={activity}
          archivedAt={targetUser.archivedAt}
          pendingRequest={
            openRequest
              ? { reason: openRequest.reason ?? '', createdAt: formatDate(openRequest.created_at) }
              : null
          }
        />
      ) : targetUser.archivedAt ? (
        <p className="mb-6 rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm font-bold text-slate-700">
          حساب محذوف (مؤرشف) — الدخول مقفول وحركاته محفوظة.
        </p>
      ) : (
        openRequest && (
          <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            العميل طالب حذف حسابه — الحذف بيعمله مدير النظام من هنا.
          </p>
        )
      )}

      <AdminUserDetailClient
        user={targetUser}
        accountEmail={accountEmail}
        orders={orders}
        serviceOrders={serviceOrders}
        sessions={sessions}
        childrenList={childrenList}
        tickets={tickets}
        isSuperAdmin={user.role === 'super_admin'}
        adminRoles={(adminRoles ?? []).map(({ id, name, isDefault }) => ({ id, name, isDefault }))}
      />
    </div>
  );
}
