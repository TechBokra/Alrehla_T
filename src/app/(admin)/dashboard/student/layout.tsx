import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'student') redirect('/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DashboardTabs
        tabs={[
          { href: '/dashboard/student', label: 'نظرة عامة' },
          { href: '/dashboard/student/sessions', label: 'جلساتي' },
          { href: '/dashboard/student/materials', label: 'موادي' },
          { href: '/dashboard/student/portfolio', label: 'معرض أعمالي' },
          // الطالب كان بيطلب من ولي أمره ومفيش مكان يتابع فيه الطلب.
          { href: '/dashboard/student/requests', label: 'طلباتي' },
          { href: '/dashboard/student/profile', label: 'ملفي' },
        ]}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
