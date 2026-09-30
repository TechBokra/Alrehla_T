import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import {
  getCurrentUser,
  ALL_ADMIN_PERMISSIONS,
  defaultPermissionsForRole,
} from '@/data/domains/auth';
import { createClient } from '@/lib/supabase/server';
import { PERMISSION_LABELS } from '@/lib/permissions';
import { PermissionsEditor, AdminRow } from './PermissionsEditor';
import { AdminPermission } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * شاشة الصلاحيات.
 *
 * قبلها: مفيش. الصلاحيات كانت مكتوبة في الكود حسب الدور، والتخصيص
 * لحساب بعينه كان مستحيل من غير تعديل كود ورفعه.
 */
export default async function Page() {
  const user = await getCurrentUser();

  // مدير النظام بس. المشرف العام ممنوع عن قصد: مين يقدر يوسّع صلاحياته
  // هو اللي بيملك المنصة فعليًا.
  if (user.role !== 'super_admin') {
    return <Unauthorized />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, role, permissions')
    .in('role', ['super_admin', 'general_supervisor'])
    .order('role', { ascending: true });

  const admins: AdminRow[] = (data ?? []).map((row) => {
    const role = row.role as 'super_admin' | 'general_supervisor';
    const stored = (row as { permissions?: string[] | null }).permissions;
    return {
      id: row.id,
      fullName: row.full_name,
      role,
      permissions:
        Array.isArray(stored) && stored.length > 0
          ? (stored as AdminPermission[])
          : null,
      defaults: defaultPermissionsForRole(role),
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الصلاحيات" backHref="/dashboard/admin/users" />

      <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-bold text-amber-900">
          الصلاحية بتتحكم في ظهور القسم في القائمة وفي قدرته يعدّل فيه. الحساب
          اللي على «الافتراضي» بياخد صلاحيات دوره كاملة — ودي حالة كل الحسابات
          قبل ما تخصّص.
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800">
          ما ينفعش تعدّل صلاحيات حسابك أنت، عشان ما تقفلش الباب على نفسك.
        </p>
      </div>

      {admins.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">
          مفيش حسابات إدارية.
        </p>
      ) : (
        <div className="space-y-6">
          {admins.map((admin) => (
            <PermissionsEditor
              key={admin.id}
              admin={admin}
              labels={PERMISSION_LABELS}
              allPermissions={ALL_ADMIN_PERMISSIONS}
              editable={admin.id !== user.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
