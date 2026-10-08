import { ProductListPage } from './ProductListPage';

export const dynamic = 'force-dynamic';

/** منتجات الناشرين — قسم «الناشرون» (منتجات المنصة في `/products/platform`). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ publisher?: string; state?: string }>;
}) {
  return <ProductListPage owner="publisher" params={await searchParams} />;
}
