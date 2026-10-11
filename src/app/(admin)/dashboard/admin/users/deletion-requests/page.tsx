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
 * الطلب بيفتح صفحة الحساب، والحذف من هناك (ملف 10 — ملاحظة تامر): من غير
 * حركات بيتمسح كله، وعليه حركات بيتقفل ويتأرشف. والطلب بيتقفل لوحده مع
 * الحذف، وبيفضل موجود كدليل حتى بعد ما الحساب يتمسح.
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
  const archivedIds = new Set(users.filter((u) => u.archivedAt).map((u) => u.id));
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const rows = (requests ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: nameById.get(r.user_id) ?? 'مستخدم محذوف',
    userEmail: emailById.get(r.user_id) ?? '',
    userExists: nameById.has(r.user_id),
    archived: archivedIds.has(r.user_id),
    reason: r.reason ?? '',
    status: r.status as 'pending' | 'done' | 'rejected',
    adminNotes: r.admin_notes ?? '',
    createdAt: formatDate(r.created_at),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات حذف الحسابات" />

      <p className="mb-8 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">
        افتح الحساب من الطلب واحذفه من هناك: لو مفيش عليه أي حركات بيتمسح
        نهائيًا، ولو عليه طلبات أو اشتراكات بيتقفل للأبد ويتأرشف وحركاته تفضل
        محفوظة. الطلب بيتقفل لوحده مع الحذف. (الحذف لمدير النظام.)
      </p>

      <DeletionRequestsClient requests={rows} />
    </div>
  );
}
