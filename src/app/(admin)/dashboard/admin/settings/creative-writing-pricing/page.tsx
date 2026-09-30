import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getPricingFormulaSettings } from '@/data/domains/writing';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { PricingSettingsClient } from './PricingSettingsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog') && !hasAdminPermission(user, 'canManageInstructors')) {
    return <Unauthorized />;
  }

  const settings = await getPricingFormulaSettings();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title="إعدادات تسعير الكتابة الإبداعية"
      />
      <p className="text-slate-600 mb-6">تعديل معادلة حساب سعر الجلسات الخاص بالمدربين.</p>
      <PricingSettingsClient settings={settings} />
    </div>
  );
}
