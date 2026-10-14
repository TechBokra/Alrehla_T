import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { FormError } from '@/components/ui/FormError';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminWritingDialects } from '@/data/domains/(admin)/writing/queries';
import { hasAdminPermission } from '@/lib/utils';
import { WritingDialectsClient } from './WritingDialectsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) return <Unauthorized />;

  const result = await getAdminWritingDialects();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <DashboardPageHeader title="لهجات الكتابة" />
      <p className="mb-6 text-slate-600">
        اللهجات التي يختار منها العميل في «إنها لك» عند اختيار «لهجة». الإيقاف يخفي اللهجة عن العملاء
        الجدد فقط، والطلبات السابقة تحتفظ باختيارها. أي منتج يتحكم في الأساليب المتاحة له من شاشة
        المنتج نفسه.
      </p>
      {result.ok ? (
        <WritingDialectsClient dialects={result.dialects} />
      ) : (
        <FormError message={result.error} />
      )}
    </div>
  );
}
