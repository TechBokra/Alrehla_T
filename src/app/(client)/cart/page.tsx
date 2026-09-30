import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import CartClient from './CartClient';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'سلة المشتريات',
    description: 'مراجعة المنتجات في سلة المشتريات الخاصة بك وإتمام الطلب.',
    path: '/cart',
    noIndex: true,
  });
}

export default function CartPage() {
  return <CartClient />;
}
