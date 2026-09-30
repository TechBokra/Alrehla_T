import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getManagedProducts, getPublishers } from '@/data/domains/products';
import { hasAdminPermission , formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const publishers = await getPublishers();
  const target = publishers.find(p => p.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  
  const allProducts = await getManagedProducts();
  const publisherProducts = allProducts.filter(p => p.publisherId === target.id);

  const formattedProducts = publisherProducts.map(p => ({
    ...p,
    nameDisplay: <Link href={`/dashboard/admin/products/${p.id}`} className="font-bold text-blue-600 hover:underline">{p.name}</Link>,
    priceDisplay: `${formatPrice(p.price)}`,
    categoryDisplay: p.category === 'library' ? 'مكتبة' : p.category === 'custom' ? 'مخصص' : 'اشتراك'
  }));

  const columns = [
    { header: 'اسم المنتج', accessorKey: 'nameDisplay' },
    { header: 'النوع', accessorKey: 'categoryDisplay' },
    { header: 'السعر', accessorKey: 'priceDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`تفاصيل الناشر: ${target.name}`} backHref="/dashboard/admin/publishers" />
      
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mb-8">
        <h2 className="text-2xl font-black text-slate-800 mb-2">{target.name}</h2>
        <p className="text-slate-600 leading-relaxed">{target.bio}</p>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-6">منتجات الناشر</h3>
      <SimpleDataTable columns={columns} data={formattedProducts} />
    </div>
  );
}
