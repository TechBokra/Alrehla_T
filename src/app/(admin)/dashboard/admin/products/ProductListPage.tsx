import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getManagedProducts, getPublishers } from '@/data/domains/products';
import { hasAdminPermission, formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { productCategoryLabel } from '@/lib/product-categories';
import { ProductStateBadge } from '@/components/dashboard/ProductStateBadge';
import { productState, type ProductState } from '@/lib/product-display';
import { ageLabel } from '@/lib/age-bands';

const STATE_FILTERS: { value: ProductState | 'all'; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'live', label: 'معروض' },
  { value: 'pending', label: 'مستني المراجعة' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'stopped', label: 'موقوف' },
];

const A = '/dashboard/admin/products';

/**
 * قايمة المنتجات — **لمالك واحد بس**: منتجات المنصة (`/products/platform`)
 * أو منتجات دور النشر (`/products`).
 *
 * ── ليه اتفصلوا (ملاحظة تامر) ─────────────────────────────
 *
 * «شايف خلط واضح ما بين اللي المنصة بتقدّمه واللي الناشرين بيقدّموه» —
 * كانت شاشة واحدة «كل المنتجات» فيها الاتنين، وزرار «منتج جديد» واحد
 * بيسأل عن المالك. دلوقتي كل مالك ليه قسمه وزراره، ومنتج القسم مايظهرش
 * في التاني.
 *
 * ── والفلترة في الرابط ───────────────────────────────────
 *
 * `?state=live|pending|…` و(للناشرين) `?publisher=<رقم>`. روابط عادية:
 * تتبعت لإداري تاني وزرار الرجوع بيرجّعها. والقيمة الغريبة = «الكل».
 */
export async function ProductListPage({
  owner,
  params,
}: {
  owner: 'platform' | 'publisher';
  params: { publisher?: string; state?: string };
}) {
  const user = await getCurrentUser();
  // صلاحية «الناشرون والمنتجات» للقسمين — زي ما كانت.
  if (!hasAdminPermission(user, 'canManagePublishers')) {
    return <Unauthorized />;
  }

  const [allProducts, publishers] = await Promise.all([getManagedProducts(), getPublishers()]);
  // ⚠️ بالمالك نفسه (`ownerType`) — ومنتج «ناشر» من غير ناشر (لو اتعمل
  //    قبل الفصل) بيظهر هنا عشان يتصلّح، مش يختفي.
  const mine = allProducts.filter((p) => (owner === 'platform' ? p.ownerType === 'platform' : p.ownerType !== 'platform'));

  const publisherFilter =
    owner === 'publisher' && publishers.some((p) => p.id === params.publisher) ? params.publisher! : 'all';
  const stateFilter = STATE_FILTERS.some((f) => f.value === params.state)
    ? (params.state as ProductState | 'all')
    : 'all';

  const visible = mine.filter((p) => {
    if (publisherFilter !== 'all' && p.publisherId !== publisherFilter) return false;
    if (stateFilter !== 'all' && productState(p) !== stateFilter) return false;
    return true;
  });

  const base = owner === 'platform' ? `${A}/platform` : A;
  const href = (next: { publisher?: string; state?: string }) => {
    const q = new URLSearchParams();
    const pub = next.publisher ?? publisherFilter;
    const st = next.state ?? stateFilter;
    if (pub !== 'all') q.set('publisher', pub);
    if (st !== 'all') q.set('state', st);
    const qs = q.toString();
    return `${base}${qs ? `?${qs}` : ''}`;
  };

  const rows = visible.map((p) => {
    const pub = publishers.find((x) => x.id === p.publisherId);
    return {
      ...p,
      nameDisplay: (
        <Link href={`${base}/${p.id}`} className="font-bold text-blue-600 hover:underline">
          {p.name}
        </Link>
      ),
      priceDisplay: formatPrice(p.price),
      categoryDisplay: productCategoryLabel(p.category),
      ageDisplay: ageLabel(p.minAge, p.maxAge) || '—',
      stateDisplay: <ProductStateBadge product={p} />,
      publisherDisplay: pub ? (
        <StatusBadge type="warning" label={pub.name} />
      ) : (
        <StatusBadge type="danger" label="من غير دار نشر" />
      ),
    };
  });

  const columns = [
    { header: 'اسم المنتج', accessorKey: 'nameDisplay' },
    { header: 'النوع', accessorKey: 'categoryDisplay' },
    ...(owner === 'publisher' ? [{ header: 'دار النشر', accessorKey: 'publisherDisplay' }] : []),
    { header: 'السنّ', accessorKey: 'ageDisplay' },
    { header: 'السعر', accessorKey: 'priceDisplay' },
    { header: 'الحالة', accessorKey: 'stateDisplay' },
  ];

  const chip = (active: boolean) =>
    'inline-flex min-h-[40px] items-center rounded-full border px-4 text-sm font-bold transition-colors ' +
    (active
      ? 'border-slate-900 bg-slate-900 text-white'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400');

  const pendingCount = mine.filter((p) => productState(p) === 'pending').length;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title={owner === 'platform' ? 'منتجات المنصة' : 'منتجات الناشرين'} />

      <p className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
        {owner === 'platform'
          ? 'اللي المنصة بتقدّمه بنفسها: «أنت البطل هنا» وتخصيص غلاف المكتبة والإضافات. منتجات دور النشر في قسم «الناشرون».'
          : 'إصدارات دور النشر اللي بتتعرض في المكتبة — الناشر بيضيفها من حسابه وبتعدّي على المراجعة. منتجات المنصة نفسها في قسم «منتجات المنصة».'}
      </p>

      <div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <Link
          href={`${base}/new`}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          {owner === 'platform' ? 'منتج جديد للمنصة' : 'منتج جديد لدار نشر'}
        </Link>
        {owner === 'publisher' && pendingCount > 0 && (
          <Link href={`${A}/review`} className="text-sm font-bold text-pending underline-offset-4 hover:underline">
            {pendingCount.toLocaleString('ar-EG')} منتج مستني المراجعة ←
          </Link>
        )}
      </div>

      <nav aria-label="فلترة المنتجات" className="mb-6 space-y-3">
        {owner === 'publisher' && publishers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="ml-1 text-sm font-bold text-slate-600">دار النشر:</span>
            <Link href={href({ publisher: 'all' })} className={chip(publisherFilter === 'all')}>
              الكل
            </Link>
            {publishers.map((pub) => (
              <Link key={pub.id} href={href({ publisher: pub.id })} className={chip(publisherFilter === pub.id)}>
                {pub.name}
              </Link>
            ))}
          </div>
        )}
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
        {visible.length === mine.length
          ? `${mine.length.toLocaleString('ar-EG')} منتج`
          : `${visible.length.toLocaleString('ar-EG')} من ${mine.length.toLocaleString('ar-EG')}`}
      </p>

      <SimpleDataTable columns={columns} data={rows} />
    </div>
  );
}
