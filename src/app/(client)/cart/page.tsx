import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { getDeliveryCatalog } from '@/data/domains/(client)/shipping/queries';
import CartClient from './CartClient';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'سلة المشتريات',
    description: 'مراجعة المنتجات في سلة المشتريات الخاصة بك وإتمام الطلب.',
    path: '/cart',
    noIndex: true,
  });
}

// ⚠️ إيقاف التوصيل بيتغيّر من اللوحة في أي لحظة، فالصفحة ماتتخزّنش.
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  // ⚠️ العميل كان بيعرف إن التوصيل متوقف **بعد** ما يخلّص تخصيص القصة
  //    ويوصل لآخر خطوة في الدفع. دلوقتي بيعرف وهو في السلة.
  const delivery = await getDeliveryCatalog();
  return <CartClient deliveryPaused={delivery.pause.paused} pauseMessage={delivery.pause.message} />;
}
