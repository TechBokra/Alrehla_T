import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getManagedProducts } from '@/data/domains/products';
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

  // منتجات المنصة = اللي مالهاش ناشر. بقت شاشة مستقلة في القايمة بدل
  // تبويب مدفون جوّه شاشة المنتجات.
  const allProducts = await getManagedProducts();
  const platformProducts = allProducts.filter(p => !p.publisherId);
  
  const formattedProducts = platformProducts.map(p => ({
    ...p,
    nameDisplay: <Link href={`/dashboard/admin/products/${p.id}`} className="font-bold text-blue-600 hover:underline">{p.name}</Link>,
    priceDisplay: `${formatPrice(p.price)}`,
    // ⚠️ كان شرطًا ثلاثيًّا بيكتب «اشتراك» على **أي تصنيف تاني** —
    //    نفس العطل اللي اتصلّح في شاشة المنتجات وفضل هنا. التصنيف
    //    غير المعروف لازم **يبان** لا يتسمّى غلط.
    categoryDisplay: productCategoryLabel(p.category),
    ownerDisplay: <StatusBadge type="neutral" label="المنصة" />,
    // الموقوف مخفي من الموقع ومرفوض في الطلبات الجديدة (SQL 121).
    stateDisplay: p.isActive ? (
      <StatusBadge type="success" label="معروض" />
    ) : (
      <StatusBadge type="neutral" label="موقوف" />
    ),
  }));

  const columns = [
    { header: 'اسم المنتج', accessorKey: 'nameDisplay' },
    { header: 'النوع', accessorKey: 'categoryDisplay' },
    { header: 'المالك', accessorKey: 'ownerDisplay' },
    { header: 'السعر', accessorKey: 'priceDisplay' },
    { header: 'الحالة', accessorKey: 'stateDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="منتجات المنصة" />
      <SimpleDataTable columns={columns} data={formattedProducts} />
    </div>
  );
}
