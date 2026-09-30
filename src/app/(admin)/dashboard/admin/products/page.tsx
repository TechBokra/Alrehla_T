import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getPersonalizedProducts, getPublishers } from '@/data/domains/products';
import { hasAdminPermission , formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { productCategoryLabel } from '@/lib/product-categories';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const allProducts = await getPersonalizedProducts({ includeInactive: true });
  const publishers = await getPublishers();
  
  const formattedProducts = allProducts.map(p => {
    let ownerDisplay = <StatusBadge type="neutral" label="المنصة" />;
    if (p.publisherId) {
      const pub = publishers.find(pub => pub.id === p.publisherId);
      ownerDisplay = <StatusBadge type="warning" label={pub?.name || 'ناشر'} />;
    }
    
    return {
      ...p,
      nameDisplay: <Link href={`/dashboard/admin/products/${p.id}`} className="font-bold text-blue-600 hover:underline">{p.name}</Link>,
      priceDisplay: `${formatPrice(p.price)}`,
      // ⚠️ كان شرطًا ثلاثيًّا بيكتب «اشتراك» على **أي حاجة تانية** —
      //    يعني تصنيف غير معروف كان بيتعرض غلط بدل ما يبان.
      categoryDisplay: productCategoryLabel(p.category),
      // ⚠️ الموقوف مخفي من الموقع **ومرفوض في الطلبات الجديدة**
      //    بمحفّز في القاعدة (SQL 121) — وبنود الطلبات القديمة
      //    بتفضل زي ما هي.
      stateDisplay: p.isActive ? (
        <StatusBadge type="success" label="معروض" />
      ) : (
        <StatusBadge type="neutral" label="موقوف" />
      ),
      ownerDisplay
    };
  });

  const columns = [
    { header: 'اسم المنتج', accessorKey: 'nameDisplay' },
    { header: 'النوع', accessorKey: 'categoryDisplay' },
    { header: 'المالك', accessorKey: 'ownerDisplay' },
    { header: 'السعر', accessorKey: 'priceDisplay' },
    { header: 'الحالة', accessorKey: 'stateDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="المنتجات والمكتبة" />
      
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <Link href="/dashboard/admin/products/new" className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          إضافة منتج جديد
        </Link>
      </div>
      <SimpleDataTable columns={columns} data={formattedProducts} />
    </div>
  );
}
