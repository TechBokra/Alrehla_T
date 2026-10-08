import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getPublishers } from '@/data/domains/products';
import { getPublisherPricingSettings } from '@/data/domains/admin';
import { ProductFormClient } from './ProductFormClient';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';

/**
 * «منتج جديد» — **من قسمه**: منتجات المنصة (`/products/platform/new`) أو
 * منتجات الناشرين (`/products/new`). المالك ثابت من القسم (ملاحظة تامر:
 * فصل كامل بين اللي المنصة بتقدّمه واللي الناشرين بيقدّموه).
 */
export async function NewProductPage({ owner }: { owner: 'platform' | 'publisher' }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const [publishers, pricingSettings] = await Promise.all([
    getPublishers(),
    getPublisherPricingSettings(),
  ]);
  const listHref = owner === 'platform' ? '/dashboard/admin/products/platform' : '/dashboard/admin/products';

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title={owner === 'platform' ? 'منتج جديد للمنصة' : 'منتج جديد لدار نشر'}
        backHref={listHref}
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ProductFormClient
          publishers={publishers}
          pricingSettings={pricingSettings}
          owner={owner}
          listHref={listHref}
        />
      </div>
    </div>
  );
}
