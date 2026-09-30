import React from 'react';
import { SessionRequestForm } from './SessionRequestForm';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const dynamic = 'force-dynamic';

export default function SessionRequestPage() {
  return (
    <div className="space-y-6">
      <DashboardPageHeader title="طلب مساعدة في الحجز" backHref="/account/support" />
      <p className="text-slate-600">إذا كنت تواجه صعوبة في حجز جلسة أو اختيار الباقة المناسبة، اترك بياناتك وسنقوم بالتواصل معك لتسهيل العملية.</p>
      <SessionRequestForm />
    </div>
  );
}
