import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

export default async function PublisherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'publisher') redirect('/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DashboardTabs
        tabs={[
          { href: '/dashboard/publisher', label: 'نظرة عامة' },
          { href: '/dashboard/publisher/products', label: 'منتجاتي' },
          { href: '/dashboard/publisher/orders', label: 'الطلبات' },
          // شاشة المستحقات كانت موجودة ومحدش بيوصّل لها.
          { href: '/dashboard/publisher/payouts', label: 'مستحقاتي' },
          { href: '/dashboard/publisher/profile', label: 'ملفي' },
        ]}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
