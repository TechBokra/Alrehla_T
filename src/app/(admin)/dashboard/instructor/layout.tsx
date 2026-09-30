import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

/**
 * لوحة المدرب.
 *
 * التحقق من الدور كان متكرر في كل صفحة على حدة — ولو صفحة جديدة اتنسي
 * فيها، بتبقى مفتوحة لأي حد. دلوقتي في مكان واحد.
 */
export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') redirect('/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DashboardTabs
        tabs={[
          { href: '/dashboard/instructor', label: 'نظرة عامة' },
          { href: '/dashboard/instructor/sessions', label: 'جلساتي' },
          { href: '/dashboard/instructor/students', label: 'طلابي' },
          // «خدماتي» فيها الخدمات اللي بيقدّمها **وطلباتها** في نفس
          // الشاشة — فمفيش تبويبة منفصلة للطلبات عشان ما يبقاش فيه
          // قايمتين لنفس الحاجة.
          { href: '/dashboard/instructor/services', label: 'خدماتي وطلباتها' },
          { href: '/dashboard/instructor/ratings', label: 'تقييماتي' },
          { href: '/dashboard/instructor/payouts', label: 'مستحقاتي' },
          { href: '/dashboard/instructor/profile', label: 'ملفي' },
          { href: '/dashboard/instructor/settings', label: 'الإعدادات' },
        ]}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
