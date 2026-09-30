import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'تأكيد الطلب',
    description: 'تفاصيل طلبك بعد إتمامه.',
    path: '/enha-lak/order-confirmation',
    noIndex: true,
  });
}

import { formatPrice } from '@/lib/utils';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle, Package, ArrowLeft, Clock } from 'lucide-react';
import { getOrders } from '@/data/domains/orders';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';


export default async function PaymentStatusPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const orders = await getOrders();
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <PageContainer className="!py-0 !space-y-0">
        <Section containerClassName="mx-auto w-full max-w-2xl pt-24 pb-32 text-center">
          <h1 className="mb-4 text-4xl font-black text-slate-800 md:text-5xl">طلب غير موجود</h1>
          <p className="mb-12 text-xl font-medium text-slate-500">عفواً، لم نتمكن من العثور على هذا الطلب.</p>
          <Button href="/" accentColor="rose" className="px-8 py-4">العودة للرئيسية</Button>
        </Section>
      </PageContainer>
    );
  }

  const isAwaiting = order.status === 'awaiting_verification';

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="mx-auto w-full max-w-2xl pt-24 pb-32 text-center">
        <div className={`mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full ${isAwaiting ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
          {isAwaiting ? <Clock className="h-16 w-16" /> : <CheckCircle className="h-16 w-16" />}
        </div>
        
        <h1 className="mb-4 text-4xl font-black text-slate-800 md:text-5xl">
          {isAwaiting ? 'بانتظار تأكيد الدفع' : 'شكراً لك!'}
        </h1>
        <p className="mb-12 text-xl font-medium text-slate-500">
          {isAwaiting ? 'لقد استلمنا طلبك وجاري مراجعة إيصال الدفع. سنقوم بتأكيد طلبك قريباً.' : 'تم تأكيد طلبك بنجاح، وسنبدأ في تجهيزه على الفور.'}
        </p>
        
        <Card accentColor="rose" className="mx-auto mb-12 max-w-md p-8 text-right bg-slate-50">
          <h2 className="mb-6 border-b border-slate-200 pb-4 text-lg font-bold text-slate-800">تفاصيل الطلب</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between font-medium text-slate-600">
              <span>رقم الطلب</span>
              <span className="font-bold text-slate-900">#{order.id.toUpperCase()}</span>
            </div>
            <div className="flex justify-between font-medium text-slate-600">
              <span>التاريخ</span>
              <span className="font-bold text-slate-900">{new Date(order.createdAt).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE })}</span>
            </div>
            <div className="flex justify-between font-medium text-slate-600">
              <span>الحالة</span>
              <span className={`font-bold ${isAwaiting ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isAwaiting ? 'قيد المراجعة' : 'مدفوع'}
              </span>
            </div>
            <div className="flex justify-between font-medium text-slate-600">
              <span>الإجمالي</span>
              <span className="font-bold text-amber-600">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            href="/account/orders/enha-lak"
            accentColor="rose"
            className="w-full sm:w-auto px-8 py-4 !bg-slate-900 !text-white hover:!bg-slate-800"
          >
            <Package className="h-5 w-5" />
            تتبع الطلب
          </Button>
          <Button
            href="/"
            variant="secondary"
            className="w-full sm:w-auto px-8 py-4 border-none !bg-slate-100 !text-slate-700 hover:!bg-slate-200"
          >
            العودة للرئيسية
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      </Section>
    </PageContainer>
  );
}
