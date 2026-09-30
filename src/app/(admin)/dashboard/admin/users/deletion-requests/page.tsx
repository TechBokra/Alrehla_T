import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser, getAllUsers } from '@/data/domains/auth';
import { createClient } from '@/lib/supabase/server';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { DeletionRequestsClient } from './DeletionRequestsClient';

export const dynamic = 'force-dynamic';

/**
 * طلبات حذف الحسابات.
 *
 * الشاشة دي بتعرض الطلبات وبتقفلها. **الحذف الفعلي مش منها** — بيتم من
 * لوحة Supabase بعد ما تتأكد إن مفيش طلبات أو مستحقات معلّقة. عملية
 * مالهاش رجعة ما ينفعش تتعمل بزرار في صفحة ويب.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageUsers')) {
    return <Unauthorized />;
  }

  const supabase = await createClient();
  const [{ data: requests }, users] = await Promise.all([
    supabase
      .from('account_deletion_requests')
      .select('*')
      .order('created_at', { ascending: false }),
    getAllUsers(),
  ]);

  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const rows = (requests ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: nameById.get(r.user_id) ?? 'مستخدم محذوف',
    userEmail: emailById.get(r.user_id) ?? '',
    reason: r.reason ?? '',
    status: r.status as 'pending' | 'done' | 'rejected',
    adminNotes: r.admin_notes ?? '',
    createdAt: formatDate(r.created_at),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات حذف الحسابات" backHref="/dashboard/admin/users" />

      <p className="mb-8 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">
        العميل بيطلب، وإنت بتراجع. اتأكد الأول إن مفيش طلبات مدفوعة أو حجوزات
        جارية أو مستحقات على الحساب. الحذف الفعلي بيتم من لوحة Supabase —
        مش من هنا، لأنها عملية مالهاش رجعة.
      </p>

      <DeletionRequestsClient requests={rows} />
    </div>
  );
}
