import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  getPricingFormulaSettings,
  getProviderPricingSettings,
  getPublisherPricingSettings,
} from '@/data/domains/(shared)/pricing/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { PricingTabsClient, type PricingTabKey } from './PricingTabsClient';

export const dynamic = 'force-dynamic';

/**
 * معادلات التسعير التلاتة في شاشة واحدة بتبويبات.
 *
 * ⚠️ **كل تبويب بصلاحيته الأصلية.** التجميع شكلي — اللي ماكانش شايف
 *    شاشة تسعير الناشرين قبل كده مش هيشوف تبويبها دلوقتي.
 */
export default async function Page() {
  const user = await getCurrentUser();

  const canSessions =
    hasAdminPermission(user, 'canManageCatalog') || hasAdminPermission(user, 'canManageInstructors');
  const canProviders = hasAdminPermission(user, 'canManageCatalog');
  const canPublishers =
    hasAdminPermission(user, 'canManageCatalog') || hasAdminPermission(user, 'canManagePublishers');

  if (!canSessions && !canProviders && !canPublishers) {
    return <Unauthorized />;
  }

  const [sessions, providers, publishers] = await Promise.all([
    getPricingFormulaSettings(),
    getProviderPricingSettings(),
    getPublisherPricingSettings(),
  ]);

  const tabs: { key: PricingTabKey; settings: typeof sessions }[] = [];
  if (canSessions) tabs.push({ key: 'sessions', settings: sessions });
  if (canProviders) tabs.push({ key: 'providers', settings: providers });
  if (canPublishers) tabs.push({ key: 'publishers', settings: publishers });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="معادلات التسعير" />
      <p className="mb-6 text-slate-600">
        كل معادلة بتحسب سعر العميل من مستحق صاحب الشغل. التلاتة منفصلة عن بعض —
        تغيير واحدة مابيأثّرش على التانيتين.
      </p>
      <PricingTabsClient tabs={tabs} />
    </div>
  );
}
