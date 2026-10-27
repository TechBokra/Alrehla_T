import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getOfferRequests } from '@/data/domains/(admin)/providers/offer-requests';
import { getPricingFormulaSettings } from '@/data/domains/(shared)/pricing/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { OfferRequestsClient } from './OfferRequestsClient';

export const dynamic = 'force-dynamic';

/**
 * طلبات تقديم الخدمات — مين طالب يقدّم أنهي خدمة وبكام، والقرار من هنا.
 * (طلب تامر، ٢٧ أكتوبر: «بدخل جوا صفحة المدرب علشان اعمل حفظ».)
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageInstructors')) {
    return <Unauthorized />;
  }

  const [requests, formula] = await Promise.all([getOfferRequests(), getPricingFormulaSettings()]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات تقديم الخدمات" />
      <p className="mb-6 text-slate-600">
        كل مدرب أو مقدّم مستقل طلب يقدّم خدمة جديدة أو يعدّل سعره — مع اسمه، والسعر اللي طلبه، وسعر العميل
        بعد معادلة المنصة. الاعتماد أو الرفض من هنا مباشرة، والمقدّم بيوصله إشعار.
      </p>
      <OfferRequestsClient requests={requests} formula={formula} />
    </div>
  );
}
