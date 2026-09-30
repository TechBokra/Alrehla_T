import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getPersonalizedProducts, getPublishers } from '@/data/domains/products';
import { getPublisherPricingSettings } from '@/data/domains/admin';
import { ProductEditFormClient } from '../ProductEditFormClient';
import { ProductStateToggle } from '../ProductStateToggle';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { saveProduct } from '@/actions/products';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const allProducts = await getPersonalizedProducts({ includeInactive: true });
  const target = allProducts.find(p => p.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  const publishers = await getPublishers();
  const pricingSettings = await getPublisherPricingSettings();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="تعديل المنتج" backHref="/dashboard/admin/products" />
      
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ProductEditFormClient product={target} publishers={publishers} pricingSettings={pricingSettings} />

        {/* ⚠️ الإيقاف برّه نموذج الحفظ عن قصد: ده إجراء بأثر فوري
            على الموقع، مش حقل بيتحفظ مع الباقي. */}
        <ProductStateToggle
          productId={target.id}
          productName={target.name}
          isActive={target.isActive}
        />
      </div>
    </div>
  );
}
