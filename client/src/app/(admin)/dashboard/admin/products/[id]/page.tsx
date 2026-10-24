import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getManagedProductById } from '@/data/domains/(admin)/products/queries';
import { getPublishers } from '@/data/domains/(shared)/publishers/queries';
import { getPublisherPricingSettings } from '@/data/domains/(shared)/pricing/queries';
import { ProductEditFormClient } from '../ProductEditFormClient';
import { ProductStateToggle } from '../ProductStateToggle';
import { ProductDeliveryDaysForm } from '../ProductDeliveryDaysForm';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
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
  const target = await getManagedProductById(id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  // كل منتج بيرجع لقسمه — المنصة أو الناشرين.
  const isPlatform = target.ownerType === 'platform';
  const publishers = await getPublishers();
  const pricingSettings = await getPublisherPricingSettings();
  const { deliveryDays } = await getSiteSettings();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title={isPlatform ? 'تعديل منتج المنصة' : 'تعديل منتج دار نشر'}
        backHref={isPlatform ? '/dashboard/admin/products/platform' : '/dashboard/admin/products'}
      />
      
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ProductEditFormClient product={target} publishers={publishers} pricingSettings={pricingSettings} />

        <ProductDeliveryDaysForm
          productId={target.id}
          electronic={target.deliveryDaysElectronic}
          printed={target.deliveryDaysPrinted}
          globalDays={deliveryDays}
          hasElectronic={(target.electronicPrice ?? 0) > 0}
        />

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
