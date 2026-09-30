import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getSubscriptionTiers } from '@/data/domains/products';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { BoxPlansClient } from './BoxPlansClient';

export const dynamic = 'force-dynamic';

/**
 * خطط صندوق الرحلة.
 *
 * الشاشة القديمة كانت جدول عرض فقط: بتقرا الاسم والمدة والسعر وخلاص.
 * مفيش إضافة ولا تعديل ولا حذف — فتغيير سعر باقة كان يحتاج مبرمج.
 *
 * `includeInactive` عشان الإدارة تشوف الباقات المقفولة وتعدّلها؛ الزائر
 * بيشوف المفعّلة بس (مفروضة بصلاحية قاعدة البيانات مش بالكود).
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSubscriptions')) {
    return <Unauthorized />;
  }

  const plans = await getSubscriptionTiers({ includeInactive: true });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="خطط صندوق الرحلة"
        backHref="/dashboard/admin/subscriptions/box"
      />
      <BoxPlansClient plans={plans} />
    </div>
  );
}
