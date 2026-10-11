import { NewProductPage } from '../../NewProductPage';

export const dynamic = 'force-dynamic';

/** منتج جديد **للمنصة** — من قسم «منتجات المنصة». */
export default function Page() {
  return <NewProductPage owner="platform" />;
}
