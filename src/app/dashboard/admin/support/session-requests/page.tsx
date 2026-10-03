import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getSupportSessionRequests } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SessionRequestsClient } from './SessionRequestsClient';

export const dynamic = 'force-dynamic';

/**
 * «طلبات الجلسات المخصصة» — العميل بيطلب مساعدة في اختيار مدرب أو باقة
 * (من «حسابي ← الدعم ← طلب مساعدة في الحجز»).
 *
 * ⚠️ كانت جدول عرض بس: من غير رقم التليفون (وهو الطريق الوحيد للرد) ولا
 *    أي زرار يغيّر الحالة — وحالة «مغلقة» مكتوبة بقيمة مش موجودة في القاعدة.
 *    بقت في قسم «الجلسات» (ملاحظة تامر)، وكل طلب كارت فيه الرقم وواتساب
 *    والحساب وأزرار الحالة.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSupport')) {
    return <Unauthorized />;
  }

  const requests = await getSupportSessionRequests();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات الجلسات المخصصة" />
      <SessionRequestsClient requests={requests} />
    </div>
  );
}
