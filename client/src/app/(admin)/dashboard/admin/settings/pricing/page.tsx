import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  getPricingFormulaSettings,
  getProviderPricingSettings,
  getPublisherPricingSettings,
} from '@/data/domains/(shared)/pricing/queries';
import { readPaymentSettingsForAdmin } from '@/actions/payments';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { PricingTabsClient, type PricingTabKey } from './PricingTabsClient';
import type { PaymentSettingsPayload } from './types';

export const dynamic = 'force-dynamic';

/**
 * التسعير والمدفوعات — كل قرار مالي في شاشة واحدة.
 *
 * ⚠️ **كانوا أربع شاشات في تلات أقسام مختلفة:** تسعير الكتابة تحت
 *    «الباقات»، تسعير الناشرين تحت «الناشرون»، تسعير المقدّمين تحت
 *    الإعدادات، وإعدادات الدفع تحت «طلبات المنتجات». قرارات بتتاخد
 *    مع بعض، ومتفرّقة على أماكن مالهاش علاقة ببعضها.
 *
 * ⚠️ **وكل تبويب بصلاحيته الأصلية.** اللي معاه `canManagePayments`
 *    وبس بيشوف تبويب الدفع لوحده؛ واللي مالوش أي صلاحية منهم بيترفض.
 *    التجميع شكلي — مفيش صلاحية بتتوسّع.
 */
export default async function Page() {
  const user = await getCurrentUser();

  // ⚠️ **`canManageFinance` اتضافت هنا عن قصد، وهي توسيع صلاحية
  //    حقيقي.** قبل كده حامل صلاحية المالية ماكانش يقدر يعدّل أي
  //    معادلة تسعير — وده كان بيخلّي القرارات المالية موزّعة على
  //    ناس مختلفة. الطلب كان إن المسؤول عنها يبقى واحد، فالمالية
  //    بقت بتفتح التبويبات كلها.
  //
  //    ولو ده مش المطلوب، شيل `|| isFinance` من السطور دي وبس —
  //    الباقي مابيتغيّرش.
  const isFinance = hasAdminPermission(user, 'canManageFinance');

  const canSessions =
    isFinance ||
    hasAdminPermission(user, 'canManageCatalog') ||
    hasAdminPermission(user, 'canManageInstructors');
  const canProviders = isFinance || hasAdminPermission(user, 'canManageCatalog');
  const canPublishers =
    isFinance ||
    hasAdminPermission(user, 'canManageCatalog') ||
    hasAdminPermission(user, 'canManagePublishers');
  const canPayments = isFinance || hasAdminPermission(user, 'canManagePayments');

  if (!canSessions && !canProviders && !canPublishers && !canPayments) {
    return <Unauthorized />;
  }

  const [sessions, providers, publishers, payments] = await Promise.all([
    getPricingFormulaSettings(),
    getProviderPricingSettings(),
    getPublisherPricingSettings(),
    // ⚠️ مابتتندهش غير بصلاحيتها — الأكشن بيرفض لوحده، بس مفيش
    //    داعي نستدعي قراءة هتترفض.
    canPayments ? readPaymentSettingsForAdmin() : Promise.resolve(null),
  ]);

  const tabs: { key: Exclude<PricingTabKey, 'payments'>; settings: typeof sessions }[] = [];
  if (canSessions) tabs.push({ key: 'sessions', settings: sessions });
  if (canProviders) tabs.push({ key: 'providers', settings: providers });
  if (canPublishers) tabs.push({ key: 'publishers', settings: publishers });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="التسعير والمدفوعات" />
      <p className="mb-6 text-slate-600">
        معادلات حساب سعر العميل من مستحق صاحب الشغل، وإعدادات استقبال الفلوس.
        المعادلات التلاتة منفصلة عن بعض — تغيير واحدة مابيأثّرش على التانيتين.
      </p>
      <PricingTabsClient tabs={tabs} payments={payments as PaymentSettingsPayload | null} />
    </div>
  );
}
