import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getManagedProducts, getPublishers } from '@/data/domains/products';
import { hasAdminPermission , formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { productCategoryLabel } from '@/lib/product-categories';
import { ProductStateBadge } from '@/components/dashboard/ProductStateBadge';
import { productState, type ProductState } from '@/lib/product-display';
import { ageLabel } from '@/lib/age-bands';

export const dynamic = 'force-dynamic';

const STATE_FILTERS: { value: ProductState | 'all'; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'live', label: 'معروض' },
  { value: 'pending', label: 'مستني المراجعة' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'stopped', label: 'موقوف' },
];

/**
 * شاشة المنتجات في الإدارة.
 *
 * ⚠️ **كانت بتقرا بصلاحية الزائر** — فالموقوف والمستني والمرفوض كانوا
 *    بيختفوا منها، وعمود «موقوف» مستحيل يظهر (التفصيل في
 *    `getManagedProducts`).
 *
 * ── والفلترة في الرابط لا في الشاشة ────────────────────────
 *
 * `?publisher=<رقم>|platform` و`?state=live|pending|…`. الصفحة صفحة
 * خادم، فالفلتر روابط عادية: بتشتغل من غير جافاسكربت، وتتبعت لإداري
 * تاني («شوف منتجات الناشر ده المستنية»)، وزرار الرجوع بيرجّع الفلتر.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ publisher?: string; state?: string }>;
}) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const params = await searchParams;
  const allProducts = await getManagedProducts();
  const publishers = await getPublishers();

  // ⚠️ القيمة من الرابط بتتحقّق: قيمة غريبة = «الكل»، مش جدول فاضي.
  const publisherFilter =
    params.publisher === 'platform' || publishers.some((p) => p.id === params.publisher)
      ? params.publisher!
      : 'all';
  const stateFilter = STATE_FILTERS.some((f) => f.value === params.state)
    ? (params.state as ProductState | 'all')
    : 'all';

  const visible = allProducts.filter((p) => {
    if (publisherFilter === 'platform' && p.publisherId) return false;
    if (publisherFilter !== 'all' && publisherFilter !== 'platform' && p.publisherId !== publisherFilter)
      return false;
    if (stateFilter !== 'all' && productState(p) !== stateFilter) return false;
    return true;
  });

  const href = (next: { publisher?: string; state?: string }) => {
    const q = new URLSearchParams();
    const pub = next.publisher ?? publisherFilter;
    const st = next.state ?? stateFilter;
    if (pub !== 'all') q.set('publisher', pub);
    if (st !== 'all') q.set('state', st);
    const qs = q.toString();
    return `/dashboard/admin/products${qs ? `?${qs}` : ''}`;
  };

  const formattedProducts = visible.map(p => {
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
      ageDisplay: ageLabel(p.minAge, p.maxAge) || '—',
      // ⚠️ كانت «معروض/موقوف» من `isActive` وحده — فمنتج مستني
      //    المراجعة كان مكتوب عليه «معروض» وهو مستخبي عن الموقع.
      stateDisplay: <ProductStateBadge product={p} />,
      ownerDisplay
    };
  });

  const columns = [
    { header: 'اسم المنتج', accessorKey: 'nameDisplay' },
    { header: 'النوع', accessorKey: 'categoryDisplay' },
    { header: 'المالك', accessorKey: 'ownerDisplay' },
    { header: 'السنّ', accessorKey: 'ageDisplay' },
    { header: 'السعر', accessorKey: 'priceDisplay' },
    { header: 'الحالة', accessorKey: 'stateDisplay' }
  ];

  const chip = (active: boolean) =>
    'inline-flex min-h-[40px] items-center rounded-full border px-4 text-sm font-bold transition-colors ' +
    (active
      ? 'border-slate-900 bg-slate-900 text-white'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400');

  const pendingCount = allProducts.filter((p) => productState(p) === 'pending').length;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="المنتجات والمكتبة" />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <Link href="/dashboard/admin/products/new" className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          إضافة منتج جديد
        </Link>
        {pendingCount > 0 && (
          <Link
            href="/dashboard/admin/products/review"
            className="text-sm font-bold text-pending underline-offset-4 hover:underline"
          >
            {pendingCount.toLocaleString('ar-EG')} منتج مستني المراجعة ←
          </Link>
        )}
      </div>

      <nav aria-label="فلترة المنتجات" className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ml-1 text-sm font-bold text-slate-600">المالك:</span>
          <Link href={href({ publisher: 'all' })} className={chip(publisherFilter === 'all')}>
            الكل
          </Link>
          <Link href={href({ publisher: 'platform' })} className={chip(publisherFilter === 'platform')}>
            المنصة
          </Link>
          {publishers.map((pub) => (
            <Link key={pub.id} href={href({ publisher: pub.id })} className={chip(publisherFilter === pub.id)}>
              {pub.name}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ml-1 text-sm font-bold text-slate-600">الحالة:</span>
          {STATE_FILTERS.map((f) => (
            <Link key={f.value} href={href({ state: f.value })} className={chip(stateFilter === f.value)}>
              {f.label}
            </Link>
          ))}
        </div>
      </nav>

      <p aria-live="polite" className="mb-3 text-sm font-bold text-slate-600">
        {visible.length === allProducts.length
          ? `${allProducts.length.toLocaleString('ar-EG')} منتج`
          : `${visible.length.toLocaleString('ar-EG')} من ${allProducts.length.toLocaleString('ar-EG')}`}
      </p>

      <SimpleDataTable columns={columns} data={formattedProducts} />
    </div>
  );
}
