import { ProductListPage } from '../ProductListPage';

export const dynamic = 'force-dynamic';

/** منتجات المنصة — اللي المنصة بتقدّمه بنفسها (منتجات الناشرين في `/products`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  return <ProductListPage owner="platform" params={await searchParams} />;
}
