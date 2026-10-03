import { NewProductPage } from '../NewProductPage';

export const dynamic = 'force-dynamic';

/** منتج جديد **لدار نشر** — من قسم «الناشرون». منتج المنصة: `/products/platform/new`. */
export default function Page() {
  return <NewProductPage owner="publisher" />;
}
