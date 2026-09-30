import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getAllUsers, getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { isAdminApiConfigured } from '@/lib/supabase/admin';
import { UsersClient } from './UsersClient';
import type { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageUsers')) {
    return <Unauthorized />;
  }

  const allUsers = await getAllUsers();
  const canInvite = isAdminApiConfigured();

  // تعبئة جاية من قبول طلب انضمام. نص في رابط لا أكتر — الإداري
  // بيراجعه، و`createUserDirectly`/`inviteUser` بيتحققوا من الدور
  // بنفسهم (`checkRole`)، فدور مكتوب في الرابط مش بيعدّي بحاله.
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const prefill =
    one('new') === '1'
      ? {
          email: one('email').slice(0, 200),
          fullName: one('name').slice(0, 120),
          role: (one('role') || 'student') as UserRole,
        }
      : null;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إدارة المستخدمين والعائلات" />
      {!canInvite && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          إضافة المستخدمين غير مفعّلة: متغير{' '}
          <code dir="ltr">SUPABASE_SERVICE_ROLE_KEY</code> غير موجود على الخادم.
        </div>
      )}
      <UsersClient
        users={allUsers}
        canInvite={canInvite}
        isSuperAdmin={user.role === 'super_admin'}
        currentUserId={user.id}
        prefill={prefill}
      />
    </div>
  );
}
