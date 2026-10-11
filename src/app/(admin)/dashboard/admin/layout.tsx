import React from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';
import { AdminSidebarNav, AdminSectionTabs } from '@/components/admin/AdminSidebarNav';
import { navFor } from '@/lib/admin-nav';

/**
 * التقسيم (مجموعات ← أقسام ← تبويبات) في `lib/admin-nav.ts` — مكان واحد،
 * ومعاه اختبار بيتأكد إن كل تبويب ليه صفحة.
 */

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user.role !== 'super_admin' && user.role !== 'general_supervisor') {
    redirect('/dashboard');
  }

  // الفلترة بتتعمل هنا على السيرفر: التبويب اللي مالكش صلاحيته ما بيوصلش
  // للمتصفح أصلًا. والقسم والمجموعة اللي بقوا فاضيين بيختفوا.
  const groups = navFor((permission) => hasAdminPermission(user, permission));

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 w-full">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-l border-slate-200 shrink-0 md:min-h-screen flex flex-col">
        <div className="p-6 pb-4">
          <Link href="/dashboard/admin" className="text-xl font-black text-slate-800 hover:text-amber-500 transition-colors">
            لوحة الإدارة
          </Link>
        </div>

        <AdminSidebarNav groups={groups} />

        <div className="p-4 border-t border-slate-200">
          <LogoutButton className="w-full" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-full overflow-hidden">
        <AdminSectionTabs groups={groups} />
        {children}
      </main>
    </div>
  );
}
