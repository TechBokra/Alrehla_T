import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { FormError } from '@/components/ui/FormError';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminPromotions } from '@/data/domains/(admin)/promotions/queries';
import { hasAdminPermission } from '@/lib/utils';
import { PromotionsClient } from './PromotionsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) return <Unauthorized />;

  const result = await getAdminPromotions();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="العروض والخصومات" />
      <p className="mb-6 text-slate-600">
        اضبط سعرًا مخفّضًا لقصة أو إضافة أو خطة صندوق لفترة محددة. يظهر للعميل السعر الأصلي بخط عليه
        والسعر الجديد وتاريخ الانتهاء، وينتهي العرض وحده في موعده. السعر المدفوع يُحسب في قاعدة
        البيانات وقت الطلب، والطلبات السابقة لا تتغير. التواريخ بتوقيت القاهرة.
      </p>
      {result.ok ? (
        <PromotionsClient
          promotions={result.promotions}
          targets={result.targets}
          nowIso={new Date().toISOString()}
        />
      ) : (
        <FormError message={result.error} />
      )}
    </div>
  );
}
