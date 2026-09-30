import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'إتمام الطلب',
    description: 'مراجعة الطلب وبيانات الشحن وإتمام الدفع.',
    path: '/enha-lak/checkout',
    noIndex: true,
  });
}

import { getSiteSettings } from '@/data/domains/content';
import { getShippingRates } from '@/data/domains/orders';
import { getCurrentUser } from '@/data/domains/auth';
import { CheckoutClient } from './CheckoutClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const settings = await getSiteSettings();
  const shippingRates = await getShippingRates();
  
  if (!user) {
    redirect('/sign-in?callbackUrl=/enha-lak/checkout');
  }

  // We pass the user to the client component to pre-fill info
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">إتمام الطلب والدفع</h1>
        <p className="mt-2 text-slate-600">أكمل بياناتك وأختر طريقة الدفع المناسبة لإتمام طلبك.</p>
      </div>

      <CheckoutClient
        user={user}
        paymentWalletNumber={settings.paymentWalletNumber}
        paymentQrUrl={settings.paymentQrUrl}
        shippingRates={shippingRates}
      />
    </div>
  );
}
