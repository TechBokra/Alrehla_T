import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getPersonalizedProducts, getPublishers } from '@/data/domains/products';
import { getPublisherPricingSettings } from '@/data/domains/admin';
import { ProductFormClient } from '../ProductFormClient';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { saveProduct } from '@/actions/products';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const publishers = await getPublishers();
  const pricingSettings = await getPublisherPricingSettings();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إضافة منتج جديد" backHref="/dashboard/admin/products" />
      
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ProductFormClient publishers={publishers} pricingSettings={pricingSettings} />
      </div>
    </div>
  );
}
