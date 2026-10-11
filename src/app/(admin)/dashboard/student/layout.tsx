import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'student') redirect('/dashboard');
  const dependent = await getDependentGuardian(user.id);
  const isDependent = Boolean(dependent);

  const tabs = [
    { href: '/dashboard/student', label: 'نظرة عامة' },
    { href: '/dashboard/student/sessions', label: 'جلساتي' },
    { href: '/dashboard/student/materials', label: 'موادي' },
    { href: '/dashboard/student/portfolio', label: 'معرض أعمالي' },
    { href: '/dashboard/student/requests', label: isDependent ? 'طلباتي من ولي الأمر' : 'طلباتي' },
    { href: '/dashboard/student/profile', label: isDependent ? 'ملفي' : 'ملفي الشخصي' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DashboardTabs tabs={tabs} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
