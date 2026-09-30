import { notFound } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { getManagedProducts, getMyPublisher } from '@/data/domains/products';
import Link from 'next/link';
import { productCategoryLabel } from '@/lib/product-categories';
import { ProductStateBadge } from '@/components/dashboard/ProductStateBadge';
import { ageLabel } from '@/lib/age-bands';

export const dynamic = 'force-dynamic';

export default async function PublisherProductsPage() {
  // الناشر بتاع الحساب اللي داخل. كان مكتوب هنا «أول ناشر في
  // الجدول» — يعني أي ناشر كان بيشوف بيانات الناشر الأول مش بتاعته.
  const myPublisher = await getMyPublisher();
  if (!myPublisher) notFound();
  
  const allProducts = await getManagedProducts();
  const myProducts = allProducts.filter(p => p.publisherId === myPublisher.id);

  // ⚠️ الخريطة القديمة كانت بتترجم «كتاب» و«لعبة» و«ملحق» —
  //    تصنيفات القاعدة أصلًا مش بتقبلها.

  const formattedProducts = myProducts.map(product => ({
    ...product,
    nameDisplay: <Link href={`/dashboard/publisher/products/${product.id}`} className="font-bold text-blue-600 hover:underline">{product.name}</Link>,
    priceDisplay: `${formatPrice(product.price)}`,
    categoryDisplay: productCategoryLabel(product.category),
    ageDisplay: ageLabel(product.minAge, product.maxAge) || '—',
    // ⚠️ **الشاشة ماكانتش بتقول للناشر إن منتجه واقف.** كل تعديل منه
    //    بيرجّع المنتج «للمراجعة» (ملف 130) فيختفي من الموقع — والناشر
    //    مايعرفش، ولو اترفض مايعرفش السبب. سبب الرفض تحت الشارة.
    stateDisplay: (
      <div className="space-y-1">
        <ProductStateBadge product={product} />
        {product.reviewStatus === 'rejected' && product.reviewNote && (
          <p className="max-w-[240px] text-xs leading-relaxed font-medium text-slate-600">
            {product.reviewNote}
          </p>
        )}
      </div>
    ),
  }));

  const columns = [
    { header: 'اسم المنتج', accessorKey: 'nameDisplay' },
    { header: 'النوع', accessorKey: 'categoryDisplay' },
    { header: 'السنّ', accessorKey: 'ageDisplay' },
    { header: 'السعر', accessorKey: 'priceDisplay' },
    { header: 'الحالة', accessorKey: 'stateDisplay' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title="منتجاتي" 
        backHref="/dashboard/publisher"
      />
      
      <div className="flex justify-start mb-6">
        <Link href="/dashboard/publisher/products/new" className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          إضافة منتج جديد
        </Link>
      </div>

      <SimpleDataTable columns={columns} data={formattedProducts} />
    </div>
  );
}
