'use client';
import { formatPrice } from '@/lib/utils';

import React, { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { TransferInstructions } from '@/components/checkout/TransferInstructions';
import { UserProfile as UserType } from '@/types';
import { CreditCard, Wallet, MapPin, Truck, ShieldCheck, ChevronRight, CheckCircle2, Plus, Minus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createOrder, submitPaymentProof } from '@/actions/orders';
import type { PaymentMethod } from '@/actions/orders';
import { PaymentProofForm } from '@/components/checkout/PaymentProofForm';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { optimizedImageUrl } from '@/lib/cloudinary';

interface Props {
  /** Read from site settings — it used to be a placeholder number in the code. */
  paymentWalletNumber: string;
  /** InstaPay QR from site settings, when one has been uploaded. */
  paymentQrUrl?: string;
  /** Shipping fee per area, set by the admin. Empty until configured. */
  shippingRates: { governorate: string; city: string; fee: number }[];
  user: UserType;
}

export function CheckoutClient({ user, paymentWalletNumber, paymentQrUrl, shippingRates }: Props) {
  const { items, cartTotal, clearCart, updateQuantity, removeItem } = useCart();
  const [step, setStep] = useState<1 | 2>(1); // 1: Shipping, 2: Payment
  // Card, wallet and Fawry options used to be offered here with forms that
  // were never read by anything: the customer typed a real card number, was
  // told the payment succeeded, and nothing was ever charged. Until a real
  // payment gateway is integrated, transfer is the only method on offer.
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [orderError, setOrderError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<{ id: string; reference: string } | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);

  // Form states
  const [shippingInfo, setShippingInfo] = useState({
    name: user.fullName || '',
    phone: '',
    address: '',
    city: '',
    gov: '',
    notes: '',
  });

  const subtotal = cartTotal;
  // Shipping is not flat: it comes from the rate set for the chosen
  // governorate. A flat 50 EGP used to be charged with the comment
  // "Fixed shipping logic for demo".
  const needsShipping = items.some((item: { type?: string }) => item.type !== 'subscription');
  // The rate is per area, not per governorate: Cairo and Shorouk are both in
  // Cairo and are not the same trip.
  const matchedRate = shippingRates.find(
    (r) => r.governorate === shippingInfo.gov && r.city === shippingInfo.city
  );
  const areasByGovernorate = shippingRates.reduce<Record<string, typeof shippingRates>>(
    (acc, rate) => {
      (acc[rate.governorate] ??= []).push(rate);
      return acc;
    },
    {}
  );
  const shippingKnown = !needsShipping || Boolean(matchedRate);
  const shipping = needsShipping ? (matchedRate?.fee ?? 0) : 0;
  const grandTotal = subtotal + shipping;

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * الخطوة الأولى: تسجيل الطلب.
   *
   * الطلب بيتسجّل **قبل** الدفع عشان الرقم المرجعي يتولّد ويوصل للعميل
   * يكتبه في ملاحظة التحويل. قبل كده كان الطلب والإيصال بيتبعتوا مرة
   * واحدة، فما كانش فيه رقم يربط التحويل بالطلب.
   */
  const handleRegisterOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setOrderError('');
    startTransition(async () => {
      // الواجهة بتبعت إيه اتطلب وبس. الأسعار والشحن بيتحسبوا في القاعدة،
      // فالأرقام المعروضة فوق للعرض بس — مش هي اللي بتتحسب على العميل.
      const result = await createOrder(
        items.map(
          (i: {
            productId: string;
            quantity: number;
            customizationData?: unknown;
            addonIds?: string[];
            customizedAddonIds?: string[];
          }) => ({
            productId: i.productId,
            quantity: i.quantity,
            customizationData: i.customizationData,
            addonIds: i.addonIds,
            customizedAddonIds: i.customizedAddonIds,
          }),
        ),
        {
          recipientName: shippingInfo.name,
          recipientPhone: shippingInfo.phone,
          addressLine: shippingInfo.address,
          city: shippingInfo.city,
          governorate: shippingInfo.gov,
          notes: shippingInfo.notes,
        },
      );

      setIsProcessing(false);

      if (!result.ok) {
        // العربة ما بتتفضّاش عند الفشل: العميل يصحّح ويعيد المحاولة.
        setOrderError(result.error);
        return;
      }

      setPlacedOrder({ id: result.orderId, reference: result.paymentReference });
    });
  };

  /** الخطوة التانية: الإيصال بعد التحويل. */
  const handleReceipt = (payment: { method: PaymentMethod; receiptUrl: string }) => {
    if (!placedOrder) return;
    setIsProcessing(true);
    setOrderError('');
    startTransition(async () => {
      const result = await submitPaymentProof(placedOrder.id, payment);
      setIsProcessing(false);

      if (!result.success) {
        setOrderError(result.error ?? 'تعذّر إرسال الإيصال');
        return;
      }

      clearCart();
      router.push('/enha-lak/order-confirmation?id=' + placedOrder.id);
    });
  };

  if (items.length === 0 && !isSuccess) {
    return (
      <Section containerClassName="py-16 text-center max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">عربة التسوق فارغة</h2>
        <p className="text-slate-500 mb-8">لم تقم بإضافة أي منتجات لتتمكن من إتمام الدفع.</p>
        <Button href="/enha-lak" accentColor="rose" className="px-8 py-3">
          تصفح المتجر
        </Button>
      </Section>
    );
  }

  if (isSuccess) {
    return (
      <Card accentColor="rose" className="p-8 md:p-12 text-center max-w-2xl mx-auto">
        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="h-12 w-12" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-800 mb-4">تم تأكيد طلبك بنجاح!</h2>
        {/* A random number used to be shown as "your order number", and the
            page claimed an invoice had been emailed — no email is sent
            anywhere in this flow. */}
        <p className="mb-8 text-slate-600">
          يمكنك متابعة حالة الطلب من صفحة طلباتك في حسابك.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="/dashboard" variant="neutral" className="px-8 py-3">
            الذهاب للوحة التحكم
          </Button>
          <Button href="/enha-lak" variant="secondary" className="px-8 py-3 border-none !bg-rose-50 !text-rose-700 hover:!bg-rose-100">
            العودة للمتجر
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Section containerClassName="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-0 pb-24">
      
      {/* Forms Section */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Step 1: Shipping */}
        <Card accentColor="rose" className={`p-6 md:p-8 transition-all ${step === 1 ? 'border-rose-200 shadow-md' : 'bg-slate-50 opacity-60'}`}>
          <div className="flex items-center gap-4 mb-8">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${step === 1 ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
            <h2 className="text-xl font-black text-slate-800">بيانات التوصيل</h2>
          </div>

          {step === 1 && (
            <form onSubmit={handleShippingSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">الاسم بالكامل</label>
                  <input type="text" required value={shippingInfo.name} onChange={e => setShippingInfo({...shippingInfo, name: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف</label>
                  <input type="tel"
                    inputMode="tel"
                    pattern="[+]?[0-9\s()-]{7,20}" required value={shippingInfo.phone} onChange={e => setShippingInfo({...shippingInfo, phone: e.target.value})} dir="ltr" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white text-right" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">العنوان بالتفصيل (الشارع، رقم العمارة، الشقة)</label>
                <input type="text" required value={shippingInfo.address} onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white" />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    المنطقة / المدينة
                  </label>
                  <select
                    required
                    value={shippingInfo.gov && shippingInfo.city ? `${shippingInfo.gov}|${shippingInfo.city}` : ''}
                    onChange={(e) => {
                      const [gov, city] = e.target.value.split('|');
                      setShippingInfo({ ...shippingInfo, gov: gov ?? '', city: city ?? '' });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white"
                  >
                    <option value="">اختر المنطقة...</option>
                    {/* Three hard-coded governorates used to be the only choices,
                        and the fee was a flat 50 EGP whichever you picked. */}
                    {Object.entries(areasByGovernorate).map(([gov, areas]) => (
                      <optgroup key={gov} label={gov}>
                        {areas.map((area) => (
                          <option key={`${gov}|${area.city}`} value={`${gov}|${area.city}`}>
                            {area.city} — {formatPrice(area.fee)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {shippingRates.length === 0 && (
                    <p className="mt-2 text-xs font-bold text-amber-700">
                      لم تُضبط مناطق الشحن بعد — تواصل مع الإدارة.
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    ملاحظات للتوصيل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={shippingInfo.notes}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
                    placeholder="علامة مميزة، أفضل وقت للتسليم…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" className="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3 font-bold text-white hover:bg-slate-800 transition-colors">
                  المتابعة للدفع <ChevronRight className="h-5 w-5 rotate-180" />
                </button>
              </div>
            </form>
          )}
          {step === 2 && (
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-bold text-slate-800">{shippingInfo.name}</p>
                  <p className="text-sm text-slate-500">{shippingInfo.address}، {shippingInfo.city}</p>
                </div>
              </div>
              <button onClick={() => setStep(1)} className="text-sm font-bold text-rose-600 hover:underline">تعديل</button>
            </div>
          )}
        </Card>

        {/* Step 2: Payment */}
        <Card accentColor="rose" className={`p-6 md:p-8 transition-all ${step === 2 ? 'border-rose-200 shadow-md' : 'opacity-50 pointer-events-none'}`}>
          <div className="flex items-center gap-4 mb-8">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${step === 2 ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
            <h2 className="text-xl font-black text-slate-800">طريقة الدفع</h2>
          </div>

          {placedOrder ? (
            <>
              <PaymentProofForm
                reference={placedOrder.reference}
                amount={grandTotal}
                walletNumber={paymentWalletNumber}
                qrUrl={paymentQrUrl}
                accent="rose"
                busy={isProcessing || isPending}
                onSubmit={handleReceipt}
              />
              {orderError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {orderError}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleRegisterOrder} className="space-y-6">
              <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <p>
                  الدفع بالتحويل (إنستاباي أو فودافون كاش). هتسجّل الطلب الأول،
                  وهيظهرلك رقم مرجعي تكتبه في ملاحظة التحويل، وبعدها ترفع الإيصال.
                  ولن نطلب منك بيانات بطاقتك على هذه الصفحة أبدًا.
                </p>
              </div>

              {orderError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {orderError}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessing || !shippingKnown}
                  className="w-full flex justify-center items-center gap-2 rounded-xl bg-rose-600 px-8 py-4 font-black text-white hover:bg-rose-700 transition-colors shadow-lg disabled:opacity-70"
                >
                  {isPending || isProcessing ? 'جارٍ تسجيل الطلب…' : 'سجّل الطلب واعرض بيانات التحويل'}
                </button>
              </div>
            </form>
          )}
        </Card>

      </div>

      {/* Order Summary Sidebar */}
      <div>
        <Card accentColor="rose" className="p-6 sticky top-8">
          <h3 className="text-lg font-black text-slate-800 mb-6">ملخص الطلب</h3>
          
          <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {items.map((item: any) => (
              <div key={item.id} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                  <Image src={optimizedImageUrl(item.imageUrl, 160)} alt={item.name} fill sizes="96px" className="object-cover" />
                </div>
                <div className="flex-1">
                  
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-2">{item.name}</h4>
                  {item.customizationData?.childName && (
                    <p className="text-xs text-slate-500 mt-1">الطفل: {item.customizationData.childName}</p>
                  )}

                  {/* ⚠️ **الكمية كانت رقمًا مكتوبًا لا أكتر، ومفيش زرّ
                      حذف.** يعني اللي ضغط «أضف للسلة» تلات مرات بالغلط
                      كان **مايقدرش يرجّعها** — لا من هنا ولا من أي
                      شاشة تانية. الطريق الوحيد كان إنه يقفل الصفحة
                      ويبدأ من الأول، ودي خسارة عميل على غلطة ضغطة.

                      ⚠️ ومحدّش بيدفع من غير سبب: الكميات هنا بتغيّر
                      العرض بس — **السعر والإجمالي بيتحسبوا في القاعدة**
                      من الأرقام المبعوتة (قاعدة «ف»). */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={isPending || isProcessing}
                        aria-label={item.quantity <= 1 ? 'حذف من السلة' : 'إنقاص الكمية'}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 disabled:opacity-40"
                      >
                        {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-700">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={isPending || isProcessing}
                        aria-label="زيادة الكمية"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={isPending || isProcessing}
                        className="ms-1 text-xs font-bold text-slate-400 hover:text-rose-600 disabled:opacity-40"
                      >
                        حذف
                      </button>
                    </div>
                    <span className="text-sm font-bold text-rose-600">{formatPrice((item.price * item.quantity))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 py-4 border-y border-slate-100 mb-4">
            <div className="flex justify-between text-sm text-slate-600">
              <span>المجموع الفرعي</span>
              <span className="font-bold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>مصاريف الشحن</span>
              <span className="font-bold">
                {!needsShipping
                  ? 'لا ينطبق'
                  : shippingKnown
                    ? shipping === 0
                      ? 'مجاناً'
                      : formatPrice(shipping)
                    : 'يُحدَّد حسب المنطقة'}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-black text-slate-800">الإجمالي</span>
            <span className="text-2xl font-black text-rose-600">{formatPrice(grandTotal)}</span>
          </div>

          {needsShipping && !shippingKnown && (
            <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
              الإجمالي بدون مصاريف الشحن — تُحسب بعد اختيار المنطقة.
            </p>
          )}

          <div className="rounded-xl bg-slate-50 p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              تسوق آمن ومحمي. جميع بياناتك مشفرة وفقاً لمعايير الأمان العالمية.
            </p>
          </div>
        </Card>
      </div>

    </Section>
  );
}
