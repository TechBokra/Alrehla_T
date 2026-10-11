import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import {
  getCurrentUser,
  getAdminRoles,
  ALL_ADMIN_PERMISSIONS,
} from '@/data/domains/auth';
import { createClient } from '@/lib/supabase/server';
import { PERMISSION_LABELS } from '@/lib/permissions';
import {
  AdminRoleEditor,
  NewAdminRole,
  PeopleAssignment,
} from './PermissionsEditor';

export const dynamic = 'force-dynamic';

/**
 * شاشة الصلاحيات — **أدوار إدارية بأسماء**.
 *
 * ١. كل دور («محاسب»، «مسؤول محتوى»…) بصلاحياته، ومين فيه.
 * ٢. دور جديد بالاسم والصلاحيات.
 * ٣. الإداريين: أنهي دور لكل واحد.
 *
 * التغيير في الدور بيسري على كل اللي فيه — الموجودين واللي هيتضافوا.
 */
export default async function Page() {
  const user = await getCurrentUser();

  // مدير النظام بس. أي حد غيره يقدر يوسّع صلاحياته هو اللي بيملك المنصة.
  if (user.role !== 'super_admin') {
    return <Unauthorized />;
  }

  const supabase = await createClient();
  const [roles, { data: people }] = await Promise.all([
    getAdminRoles(),
    supabase
      .from('user_profiles')
      .select('*')
      .in('role', ['super_admin', 'general_supervisor'])
      .order('full_name', { ascending: true }),
  ]);

  const rows = (people ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role,
    adminRoleId: (p as { admin_role_id?: string | null }).admin_role_id ?? null,
  }));

  const superAdmins = rows.filter((p) => p.role === 'super_admin');
  const admins = rows.filter((p) => p.role === 'general_supervisor');
  const defaultRole = roles?.find((r) => r.isDefault);

  // الشخص اللي دوره اتمسح أو فاضي = في الافتراضي.
  const roleOf = (adminRoleId: string | null) =>
    roles?.find((r) => r.id === adminRoleId) ?? defaultRole;
  const peopleIn = (roleId: string) =>
    admins
      .filter((p) => roleOf(p.adminRoleId)?.id === roleId)
      .map((p) => p.fullName);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="الصلاحيات"
      />

      <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-bold text-amber-900">
          كل إداري ليه <strong>دور إداري</strong> («محاسب»، «مسؤول محتوى»…)،
          وبياخد صلاحيات دوره. تعديل صلاحيات دور بيسري على كل اللي فيه.
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800">
          عشان تضيف إداري: من{' '}
          <Link href="/dashboard/admin/users" className="font-bold underline">
            المستخدمين
          </Link>{' '}
          خلّي دوره «إداري»، وبعدين اختار له دوره من آخر الصفحة دي.
        </p>
      </div>

      {roles === null ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          جدول الأدوار الإدارية لسه مش موجود في القاعدة — شغّل ملف{' '}
          <span dir="ltr">supabase/schema/05</span> في Supabase. لحد ما يتشغّل،
          الإداريين شغّالين بالصلاحيات القديمة.
        </p>
      ) : (
        <div className="space-y-6">
          {/* مدير النظام — مقفول */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-800">مدير النظام</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {superAdmins.map((p) => p.fullName).join('، ') || '—'}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                {ALL_ADMIN_PERMISSIONS.length} من {ALL_ADMIN_PERMISSIONS.length}
              </span>
            </div>
            <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              كل الصلاحيات دايمًا، ومابتتعدّلش — عشان مدير النظام مايقفلش الباب
              على نفسه بالغلط.
            </p>
          </div>

          {roles.map((role) => (
            <AdminRoleEditor
              key={role.id}
              role={role}
              people={peopleIn(role.id)}
              labels={PERMISSION_LABELS}
              allPermissions={ALL_ADMIN_PERMISSIONS}
            />
          ))}

          <NewAdminRole
            labels={PERMISSION_LABELS}
            allPermissions={ALL_ADMIN_PERMISSIONS}
          />

          <PeopleAssignment
            people={admins.map((p) => ({
              id: p.id,
              fullName: p.fullName,
              adminRoleId: roleOf(p.adminRoleId)?.id ?? null,
            }))}
            roles={roles.map((r) => ({
              id: r.id,
              name: r.name,
              isDefault: r.isDefault,
            }))}
          />
        </div>
      )}
    </div>
  );
}
