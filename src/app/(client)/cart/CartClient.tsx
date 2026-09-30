'use client';
import { formatPrice } from '@/lib/utils';

import Link from 'next/link';
import Image from 'next/image';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Trash2, ArrowRight, Package } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { optimizedImageUrl } from '@/lib/cloudinary';

export default function CartClient() {
  const { items, removeItem, updateQuantity, cartTotal } = useCart();
  
  // A 5% "tax" used to be invented here and added to what the customer paid.
  // There is no tax configured anywhere in the platform.
  const total = cartTotal;

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="max-w-5xl pt-12 pb-24">
        <h1 className="mb-10 text-3xl font-black text-slate-800 md:text-5xl">سلة المشتريات</h1>
        
        <div className="grid gap-12 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            <Card accentColor="amber" className="p-6 md:p-8">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    <ShoppingCart className="h-10 w-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">سلتك فارغة</h3>
                  <p className="mt-2 text-slate-500">تصفح المكتبة وأضف بعض القصص الممتعة!</p>
                  <Button href="/enha-lak" variant="neutral" className="mt-6">
                    تصفح المنتجات
                  </Button>
                </div>
              ) : (
                <div className="space-y-6 divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <div key={item.id} className={`flex flex-col md:flex-row items-center gap-6 ${index > 0 ? 'pt-6' : 'pb-6 border-b border-slate-100'}`}>
                      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400">
                        {item.imageUrl ? (
                          <Image src={optimizedImageUrl(item.imageUrl, 200)} alt={item.name} fill sizes="96px" className="object-cover" />
                        ) : (
                          <Package className="h-10 w-10" />
                        )}
                      </div>
                      
                      <div className="flex-1 text-center md:text-right">
                        <h3 className="text-xl font-bold text-slate-800">{item.name}</h3>
                        {item.customizationData?.childName && (
                          <p className="mt-1 text-sm text-slate-500">اسم الطفل: {item.customizationData.childName}</p>
                        )}
                        <p className="mt-1 font-medium text-slate-500">الكمية: {item.quantity}</p>

                        <div className="mt-4 flex items-center justify-center md:justify-start gap-4">
                          <span className="text-lg font-black text-emerald-600">{formatPrice(item.price)}</span>
                        </div>
                      </div>
                      <Button 
                        variant="secondary"
                        onClick={() => removeItem(item.id)}
                        className="!h-10 !w-10 !p-0 !min-h-0 !bg-red-50 !text-red-500 hover:!bg-red-100"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            
            <Link href="/enha-lak" className="inline-flex items-center gap-2 font-bold text-slate-500 hover:text-slate-800">
              <ArrowRight className="h-5 w-5" />
              متابعة التسوق
            </Link>
          </div>

          {/* Order Summary */}
          {items.length > 0 && (
            <div className="lg:col-span-1">
              <Card accentColor="amber" className="sticky top-32 bg-slate-50 p-6 md:p-8">
                <h2 className="mb-6 text-xl font-black text-slate-800">ملخص الطلب</h2>
                
                <div className="space-y-4 border-b border-slate-200 pb-6">
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>المجموع الفرعي</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between py-6 text-xl font-black text-slate-800">
                  <span>الإجمالي</span>
                  <span>{formatPrice(total)}</span>
                </div>
                
                <Button
                  href="/enha-lak/checkout"
                  accentColor="amber"
                  className="w-full !bg-slate-900 !hover:bg-slate-800 shadow-md gap-2"
                >
                  إتمام الطلب
                  <ShoppingCart className="h-5 w-5" />
                </Button>
              </Card>
            </div>
          )}
        </div>
      </Section>
    </PageContainer>
  );
}
