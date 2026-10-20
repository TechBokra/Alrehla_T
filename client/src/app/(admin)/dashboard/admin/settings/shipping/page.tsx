import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { FormError } from '@/components/ui/FormError';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminDeliveryConfig } from '@/data/domains/(admin)/shipping/queries';
import { hasAdminPermission } from '@/lib/utils';
import { ShippingRatesClient } from './ShippingRatesClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageOrders')) return <Unauthorized />;

  const result = await getAdminDeliveryConfig();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="التوصيل وأسعار الشحن" />
      <p className="mb-6 text-slate-600">
        تحكّم في الدول التي يظهر لها التوصيل، والمحافظات والمناطق وأسعارها، وإيقاف
        التوصيل مؤقتًا. الطلبات السابقة تحتفظ بالسعر الذي دُفع وقتها، فالتعديل هنا لا
        يغيّر طلبًا قائمًا. والقواعد تُفرَض في قاعدة البيانات عند تسجيل الطلب، لا في
        الشاشة فقط.
      </p>
      {result.ok ? (
        <ShippingRatesClient config={result.config} />
      ) : (
        <FormError message={result.error} />
      )}
    </div>
  );
}
