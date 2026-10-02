import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import {
  getCurrentUser,
  getRolePermissions,
  ALL_ADMIN_PERMISSIONS,
} from '@/data/domains/auth';
import { createClient } from '@/lib/supabase/server';
import { PERMISSION_LABELS } from '@/lib/permissions';
import { RolePermissionsEditor } from './PermissionsEditor';

export const dynamic = 'force-dynamic';

/**
 * شاشة الصلاحيات — **لكل دور، مش لكل شخص**.
 *
 * الصلاحيات بتتظبط مرة للدور، وكل اللي في الدور بياخدوها: الموجودين
 * دلوقتي واللي هيتضافوا بعدين. والأسماء اللي تحت كل دور معروضة عشان
 * تعرف التغيير هيسري على مين قبل ما تحفظ.
 */
export default async function Page() {
  const user = await getCurrentUser();

  // مدير النظام بس. المشرف العام ممنوع عن قصد: مين يقدر يوسّع صلاحياته
  // هو اللي بيملك المنصة فعليًا.
  if (user.role !== 'super_admin') {
    return <Unauthorized />;
  }

  const supabase = await createClient();
  const [{ data: people }, supervisorPermissions, { error: tableError }] =
    await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .in('role', ['super_admin', 'general_supervisor'])
        .order('full_name', { ascending: true }),
      getRolePermissions('general_supervisor'),
      supabase
        .from('role_permissions')
        .select('role', { head: true, count: 'exact' }),
    ]);

  const namesOf = (role: string) =>
    (people ?? []).filter((p) => p.role === role).map((p) => p.full_name);

  const superAdmins = namesOf('super_admin');
  const supervisors = namesOf('general_supervisor');

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="الصلاحيات"
        backHref="/dashboard/admin/users"
      />

      <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-bold text-amber-900">
          الصلاحيات بتتظبط <strong>للدور</strong>، وكل اللي في الدور بياخدوها —
          اللي موجودين دلوقتي واللي هتضيفهم بعدين. الصلاحية بتتحكم في ظهور القسم
          في القائمة وفي قدرته يعدّل فيه.
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800">
          عشان تغيّر صلاحيات شخص، غيّر <strong>دوره</strong> من شاشة المستخدمين.
        </p>
      </div>

      {tableError && (
        <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          جدول صلاحيات الأدوار لسه مش موجود في القاعدة — شغّل ملف{' '}
          <span dir="ltr">supabase/schema/04</span> في Supabase. لحد ما يتشغّل،
          المشرفين شغّالين بالصلاحيات القديمة (كل حاجة ما عدا المالية والسجلات).
        </p>
      )}

      <div className="space-y-6">
        {/* مدير النظام — مقفول */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-black text-slate-800">مدير النظام</p>
              <PeopleLine names={superAdmins} />
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

        <RolePermissionsEditor
          role="general_supervisor"
          title="مشرف عام"
          people={supervisors}
          initial={supervisorPermissions}
          labels={PERMISSION_LABELS}
          allPermissions={ALL_ADMIN_PERMISSIONS}
          disabled={Boolean(tableError)}
        />
      </div>
    </div>
  );
}

function PeopleLine({ names }: { names: string[] }) {
  return (
    <p className="mt-1 text-sm font-medium text-slate-500">
      {names.length === 0
        ? 'مفيش حد في الدور ده لسه'
        : `${names.length} ${names.length === 1 ? 'شخص' : 'أشخاص'}: ${names.join('، ')}`}
    </p>
  );
}
