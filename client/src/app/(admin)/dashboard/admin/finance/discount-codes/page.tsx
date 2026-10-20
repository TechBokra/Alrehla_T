import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getDiscountCodes } from '@/data/domains/(admin)/finance/discount-codes';
import { hasAdminPermission } from '@/lib/utils';
import { DiscountCodesClient } from './DiscountCodesClient';

export const dynamic = 'force-dynamic';

/** أكواد الخصم (ملف 13) — بدل فكرة «خصم تلقائي لمشتركي بداية الرحلة». */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageFinance')) return <Unauthorized />;

  const codes = await getDiscountCodes();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="أكواد الخصم" />
      <p className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium leading-relaxed text-blue-900">
        العميل بيكتب الكود في صفحة الدفع. الخصم نسبة على المنتجات (مش على الشحن)،
        و<strong>مرة واحدة لكل عميل</strong>. لو الطلب اتلغى أو ماتدفعش، الكود بيرجع للعميل.
        نصيب الناشر وحصيلة المدرب مابيتأثروش — المنصة هي اللي بتتحمّل الخصم.
      </p>
      {codes === null ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-900">
          أكواد الخصم محتاجة ملف القاعدة 13 يتشغّل الأول.
        </p>
      ) : (
        <DiscountCodesClient codes={codes} />
      )}
    </div>
  );
}
