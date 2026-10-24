'use client';
import { PHONE_INPUT_PROPS, phoneErrorFor } from '@/lib/phone';
import { requiredFieldProps, clearCustomValidity, focusField } from '@/lib/form-validation';
import { shippingBlockers, hasOrderableRemainder, blockerLabel } from '@/lib/shipping-blockers';
import { DiscountCodeField, type AppliedDiscount } from '@/components/checkout/DiscountCodeField';
import { discountAmount } from '@/lib/discount-codes';
import { formatPrice } from '@/lib/utils';

import React, { useState } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';
import { loadDeliveryRegion } from '@/lib/delivery-region-store';
import { saveDeferredItems, takeDeferredItems } from '@/lib/cart-storage';
import { TransferInstructions } from '@/components/checkout/TransferInstructions';
import { UserProfile as UserType } from '@/types';
import { CreditCard, Wallet, MapPin, Truck, ShieldCheck, ChevronRight, CheckCircle2, Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createOrder, createBoxSubscriptionOrder, submitPaymentProof } from '@/actions/orders';
import type { PaymentMethod } from '@/actions/orders';
import { PaymentProofForm } from '@/components/checkout/PaymentProofForm';
import { GatewayPayButton } from '@/components/checkout/GatewayPayButton';
import { getResumableOrder, startGatewayPayment } from '@/actions/payments';
import { cartSignature, clearPendingOrder, loadPendingOrder, resumableFor, savePendingOrder } from '@/lib/pending-order-store';
import { METHOD_LABELS, type PaymentAvailability } from '@/lib/payments/settings';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { optimizedImageUrl } from '@/lib/cloudinary';
import {
  cartHasElectronic,
  cartNeedsShipping,
  isValidDeliveryEmail,
} from '@/lib/item-format';
import type { DeliveryCatalog } from '@/data/domains/(shared)/shipping/types';
import {
  areasOf,
  COUNTRY_CLOSED_MESSAGE,
  defaultCountryCode,
  electronicVerdict,
  governoratesOf,
  physicalClosedForCountry,
  physicalVerdict,
} from '@/lib/delivery';

interface Props {
  /** Read from site settings — it used to be a placeholder number in the code. */
  paymentWalletNumber: string;
  /** InstaPay QR from site settings, when one has been uploaded. */
  paymentQrUrl?: string;
  /** الدول والمحافظات والمناطق وأسعارها وإيقاف التوصيل — من الأدمن. للعرض فقط: القاعدة هي الحارس. */
  delivery: DeliveryCatalog;
  /**
   * نوع كل إضافة (مطبوعة / إلكترونية / الاتنين) — عشان نمسك سلة قديمة
   * فيها نسخة إلكترونية + إضافة مطبوعة **قبل** ما القاعدة ترفضها
   * (`guard_order_item_addons` — قرار ٢٤ أكتوبر).
   */
  addonFormats?: Record<string, string>;
  /** بوابة دفع ولا تحويل يدوي — من إعدادات الدفع في اللوحة. */
  payment: PaymentAvailability;
  user: UserType;
}

export function CheckoutClient({ user, paymentWalletNumber, paymentQrUrl, delivery, payment, addonFormats = {} }: Props) {
  // ⚠️ `payment` اتحاد مميّز، والتضييق جوّه JSX مابيشتغلش مع شرط مركّب —
  //    فبنفصله هنا مرة واحدة.
  const gateway = payment.mode === 'gateway' ? payment : null;
  const manualNotice = payment.mode === 'manual' ? payment.notice : '';
  const { items, cartTotal, clearCart, removeItem, addItem } = useCart();
  const [step, setStep] = useState<1 | 2>(1); // 1: Shipping, 2: Payment
  // Card, wallet and Fawry options used to be offered here with forms that
  // were never read by anything: the customer typed a real card number, was
  // told the payment succeeded, and nothing was ever charged. Until a real
  // payment gateway is integrated, transfer is the only method on offer.
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [orderError, setOrderError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<{ id: string; reference: string; total: number | null } | null>(null);
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
    // إيميل استلام النسخة الإلكترونية — إيميل الحساب افتراضيًّا (ملف 138).
    email: user.email || '',
  });
  const [emailError, setEmailError] = useState('');
  // الدولة (مصر افتراضيًا) — بتتحدد قبل المحافظة والمنطقة.
  const [country, setCountry] = useState(() => defaultCountryCode(delivery.countries));
  // ⚠️ اختبار «إنها لك» (HS0L): غلط الرقم كان بيظهر في خطوة الدفع، بعد
  //    ما العميل يعدّي صفحة البيانات. دلوقتي بيتفحص هنا وتحت الخانة نفسها.
  const [phoneError, setPhoneError] = useState('');
  // كود الخصم (ملف 13) — للعرض هنا، والقاعدة بتحسبه وقت تسجيل الطلب.
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);

  const subtotal = cartTotal;
  // Shipping is not flat: it comes from the rate set for the chosen
  // governorate. A flat 50 EGP used to be charged with the comment
  // "Fixed shipping logic for demo".
  //
  // ⚠️ الإلكتروني لوحده مالوش شحن، إلا لو معاه إضافة (ملف 138 — نفس
  //    قاعدة الدالة بالظبط).
  const needsShipping = cartNeedsShipping(items);
  const hasElectronic = cartHasElectronic(items);
  // ملف 140: الاشتراك بيتطلب **لوحده** — دالة تانية وطلب تاني.
  const boxItem = items.find((i: { boxPlanId?: string }) => i.boxPlanId) as
    | { boxPlanId: string; boxMonths?: number; customizationData?: unknown }
    | undefined;
  const boxMonths = boxItem ? Math.max(1, boxItem.boxMonths ?? 1) : 1;
  const mixedBox = Boolean(boxItem) && items.length > 1;
  // The rate is per area, not per governorate: Cairo and Shorouk are both in
  // Cairo and are not the same trip.
  //
  // ⚠️ كل ده للعرض: القاعدة (`shipping_quote`) بتفرض الدولة المفتوحة والمحافظة
  //    والمنطقة وقت تسجيل الطلب، حتى لو الشاشة اتجاوزت.
  const countryClosed = needsShipping
    ? physicalClosedForCountry(delivery, country)
    : ({ closed: false } as const);
  const verdict = needsShipping
    ? physicalVerdict(delivery, { country, governorate: shippingInfo.gov, city: shippingInfo.city })
    : null;
  const matchedFee = verdict?.available ? verdict.fee : undefined;
  const electronicCheck = hasElectronic ? electronicVerdict(delivery, country) : null;
  const electronicBlocked = electronicCheck !== null && !electronicCheck.allowed;
  const shippingKnown = !needsShipping || Boolean(verdict?.available);
  // رسالة سبب المنع تحت المنطقة (محافظة مقفولة، إلخ) غير إغلاق الدولة الكامل.
  const areaBlockedMessage =
    verdict && !verdict.available && !countryClosed.closed && shippingInfo.gov ? verdict.message : '';
  // ── سلة قديمة: نسخة إلكترونية + إضافة مطبوعة (قرار ٢٤ أكتوبر) ──
  const addonConflicts = items.filter(
    (i: CartItem) =>
      i.format === 'electronic' && (i.addonIds ?? []).some((id) => addonFormats[id] === 'printed'),
  );
  const canContinue = shippingKnown && !electronicBlocked && addonConflicts.length === 0;

  // ── طلب اتسجّل ومااتدفعش (قرار ٢٤ أكتوبر) ────────────────────
  // العميل راح صفحة الدفع ورجع من غير ما يدفع: بنعرض عليه يكمّل على
  // نفس الطلب بدل ما يتسجّل طلب تاني — **لو اختار**.
  const [resumable, setResumable] = useState<{ orderId: string; reference: string; total: number } | null>(null);
  const [resuming, setResuming] = useState(false);
  React.useEffect(() => {
    const pending = resumableFor(loadPendingOrder(), items);
    if (!pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- التخزين في المتصفح بس؛ بيتقري بعد أول رسم.
      setResumable(null);
      return;
    }
    let alive = true;
    void getResumableOrder(pending.orderId).then((r) => {
      if (!alive) return;
      if (r.ok) setResumable({ orderId: pending.orderId, reference: r.reference, total: r.total });
      else {
        // اتدفع أو اتلغى — مالوش لازمة يفضل محفوظ.
        clearPendingOrder();
        setResumable(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [items]);

  const resumeOrder = () => {
    if (!resumable) return;
    setResuming(true);
    setOrderError('');
    startTransition(async () => {
      if (gateway) {
        try {
          const pay = await startGatewayPayment(resumable.orderId, 'order');
          if (pay.ok) {
            window.location.assign(pay.url);
            return;
          }
          setOrderError(pay.error);
        } catch {
          setOrderError('تعذّر فتح صفحة الدفع. جرّب تاني.');
        }
        setResuming(false);
        return;
      }
      // التحويل: نفس الطلب، وبيانات التحويل ورفع الإيصال.
      setPlacedOrder({ id: resumable.orderId, reference: resumable.reference, total: resumable.total });
      setResuming(false);
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  // ── المنطقة اللي اتختارت في المعالج ──────────────────────────
  // «يكمّل الطلب مباشرة»: العميل اختار منطقته في خطوة ٣، فمانسألوش تاني.
  // بنستعملها بس لو لسه موجودة في الكتالوج، ولو هو ماكتبش حاجة.
  React.useEffect(() => {
    const saved = loadDeliveryRegion();
    if (!saved) return;
    const exists = delivery.rates.some(
      (r) => r.countryCode === saved.country && r.governorate === saved.gov && r.city === saved.city,
    );
    if (!exists) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- التخزين في المتصفح بس؛ القراية بعد أول رسم عشان ماتختلفش عن نسخة الخادم.
    setCountry(saved.country);
    setShippingInfo((prev) => (prev.gov ? prev : { ...prev, gov: saved.gov, city: saved.city }));
    // مرة واحدة عند الفتح بس — بعدها اختيار العميل هنا هو اللي يمشي.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ══ الشحن مقفول من اللوحة ═════════════════════════════════
     ملاحظة تامر (١٨ أكتوبر): «لما يكون الشحن مش مفعّل من لوحة
     التحكم، يظهر للعميل اعتذار إن الشحن غير متاح، ويخلّي الجزء
     بتاع الشحن معطّل».

     ⚠️ **كان العميل بيملا عنوانه بالكامل وبعدين يلاقي الزر ميّت.**
        خانة العنوان كانت بره شرط الإغلاق (المحافظة والمنطقة بس
        كانوا بيختفوا)، فبيكتب الشارع ورقم العمارة والشقة، ويدوس
        «المتابعة للدفع»، ومافيش حاجة بتحصل — وفوق سطر أصفر
        صغير. المجهود كله بيروح هدر، والعميل مش عارف إن القرار
        إداري ومش غلطة منه.

     دلوقتي: اعتذار صريح فوق الجزء، والخانات **معطّلة** (شكلها
     بيقول إنها مقفولة)، و`disabled` كمان بيخرّجها من فحص
     المتصفح — فمافيش «الخانة دي مطلوبة» على خانة مقفولة.

     ⚠️ والإغلاق ده ليه تلات أسباب من اللوحة، والرسالة بتفرّق
        بينهم: إيقاف التوصيل العام (`delivery.paused`)، أو الدولة
        مقفولة (`countries.physical_enabled`)، أو المحافظة
        (`governorates.physical_enabled`). `physicalVerdict` هي
        اللي بتحدّد، ونفس قواعدها في `shipping_quote` في القاعدة. */
  const shippingOff = needsShipping && countryClosed.closed;
  /** مين بالظبط اللي بيمنع الطلب، وهل فاضل حاجة تتطلب من غيرهم. */
  const blockers = shippingOff ? shippingBlockers(items) : [];
  const canOrderRemainder = hasOrderableRemainder(items);
  // الصندوق: سعر المنطقة × عدد الشهور (قرار تامر) — نفس حساب القاعدة.
  const shipping = needsShipping ? (matchedFee ?? 0) * boxMonths : 0;
  // الخصم على المنتجات بس، مش الشحن — نفس حساب القاعدة (ملف 13).
  const discountOff = discount ? discountAmount(subtotal, discount.percent) : 0;
  const grandTotal = subtotal - discountOff + shipping;

  // ══ التوفير ═══════════════════════════════════════════════
  //
  // ملاحظة تامر (١٥ أكتوبر): «اعرض التوفير المتحقق». كان الخصم بيبان
  // سطرًا بالسالب وبس، والعرض على المنتج نفسه (`listPrice`) مابيبانش
  // خالص — فالعميل اللي خد عرضًا وكود خصم مش شايف إنه وفّر حاجة.
  //
  // التوفير = (السعر قبل العرض − السعر الحالي) + كود الخصم.
  //
  // ⚠️ `listPrice` اختياري: السلال المحفوظة في المتصفح قبل الخانة دي
  //    مالهاش، فبنرجع لـ`price` — التوفير يطلع صفرًا مش بالسالب.
  const listTotal = items.reduce(
    (sum: number, i: CartItem) => sum + (i.listPrice && i.listPrice > i.price ? i.listPrice : i.price),
    0,
  );
  const offerSavings = Math.max(0, listTotal - subtotal);
  const totalSavings = offerSavings + discountOff;

  // كود الخصم «ذو صلة» لما يكون فيه حاجة يتحسب عليها، وقبل ما الطلب
  // يتسجّل: بعد التسجيل القاعدة قفلت الإجمالي وتغيير الكود مابيعملش حاجة.
  const discountRelevant = items.length > 0 && !placedOrder && !isSuccess;

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    // الفحص **بالدولة المختارة**: رقم مصري ناقص بيتقال له إنه ١١ رقم
    // ويبدأ بـ٠١، مش «رقم غير صحيح».
    const phoneProblemMessage = phoneErrorFor(shippingInfo.phone, country);
    if (phoneProblemMessage) {
      setPhoneError(phoneProblemMessage);
      focusField('shipping-phone');
      return;
    }
    setPhoneError('');
    if (hasElectronic && !isValidDeliveryEmail(shippingInfo.email)) {
      setEmailError('اكتب إيميل صحيح — النسخة الإلكترونية هتوصلك عليه. زي name@example.com');
      focusField('delivery-email');
      return;
    }
    setEmailError('');
    if (mixedBox) return;
    // ⚠️ **ضغطة واحدة** (قرار تامر، ٢٤ أكتوبر: «إتمام الطلب بياخد ٣
    //    صفحات»). كان: «المتابعة للدفع» ← «سجّل الطلب وكمّل الدفع» ←
    //    «ادفع» ← صفحة XPay. دلوقتي الزرار ده بيسجّل الطلب ويفتح صفحة
    //    الدفع على طول.
    placeOrder();
  };

  /**
   * الخطوة الأولى: تسجيل الطلب.
   *
   * الطلب بيتسجّل **قبل** الدفع عشان الرقم المرجعي يتولّد ويوصل للعميل
   * يكتبه في ملاحظة التحويل. قبل كده كان الطلب والإيصال بيتبعتوا مرة
   * واحدة، فما كانش فيه رقم يربط التحويل بالطلب.
   */
  const placeOrder = () => {
    setIsProcessing(true);
    setOrderError('');
    startTransition(async () => {
      const shippingDetails = {
        recipientName: shippingInfo.name,
        recipientPhone: shippingInfo.phone,
        addressLine: shippingInfo.address,
        city: shippingInfo.city,
        governorate: shippingInfo.gov,
        country,
        notes: shippingInfo.notes,
      };
      // الواجهة بتبعت إيه اتطلب وبس. الأسعار والشحن بيتحسبوا في القاعدة،
      // فالأرقام المعروضة فوق للعرض بس — مش هي اللي بتتحسب على العميل.
      const result = boxItem
        ? await createBoxSubscriptionOrder(boxItem.boxPlanId, boxItem.customizationData, shippingDetails, discount?.code)
        : await createOrder(
        items.map(
          (i: {
            productId: string;
            quantity: number;
            customizationData?: unknown;
            addonIds?: string[];
            customizedAddonIds?: string[];
            format?: 'printed' | 'electronic' | 'both';
          }) => ({
            productId: i.productId,
            quantity: i.quantity,
            customizationData: i.customizationData,
            addonIds: i.addonIds,
            customizedAddonIds: i.customizedAddonIds,
            format: i.format,
          }),
        ),
        {
          recipientName: shippingInfo.name,
          recipientPhone: shippingInfo.phone,
          addressLine: shippingInfo.address,
          city: shippingInfo.city,
          governorate: shippingInfo.gov,
          country,
          notes: shippingInfo.notes,
          deliveryEmail: hasElectronic ? shippingInfo.email : undefined,
        },
        discount?.code,
      );

      if (!result.ok) {
        setIsProcessing(false);
        // العربة ما بتتفضّاش عند الفشل: العميل يصحّح ويعيد المحاولة.
        // غلط في الرقم ← نرجّعه لصفحة البيانات وتحت الخانة، مش هنا.
        //
        // ⚠️ بالاسم مش بمقارنة نص الرسالة: المقارنة القديمة
        //    (`result.error === PHONE_ERROR`) كانت بتنكسر بالسكوت أول
        //    تعديل في كلمة، والغلط يرجع لشريط عام فوق.
        if (result.field === 'recipientPhone') {
          setPhoneError(result.error);
          setStep(1);
          focusField('shipping-phone');
          return;
        }
        setOrderError(result.error ?? 'تعذّر إرسال الإيصال');
        return;
      }

      setPlacedOrder({ id: result.orderId, reference: result.paymentReference, total: result.totalAmount });
      // عشان لو رجع من صفحة الدفع من غير ما يدفع، يقدر يكمّل على نفس الطلب.
      savePendingOrder({
        orderId: result.orderId,
        reference: result.paymentReference,
        total: result.totalAmount,
        signature: cartSignature(items),
      });

      // البوابة: على صفحة الدفع على طول — من غير زرار «ادفع» تاني.
      // ⚠️ `isProcessing` بيفضل شغّال: الصفحة بتتنقل، والزرار مايتضغطش تاني.
      if (gateway) {
        try {
          const pay = await startGatewayPayment(result.orderId, 'order');
          if (pay.ok) {
            window.location.assign(pay.url);
            return;
          }
          setOrderError(pay.error);
        } catch {
          setOrderError('الطلب اتسجّل، بس تعذّر فتح صفحة الدفع. اضغط «ادفع» تحت وجرّب تاني.');
        }
      }
      // التحويل (أو البوابة مافتحتش): بيانات الدفع تحت، والطلب مسجّل.
      setIsProcessing(false);
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

      if (!result.ok) {
        setOrderError(result.error ?? 'تعذّر إرسال الإيصال');
        return;
      }

      clearCart();
      clearPendingOrder();
      // المنتجات اللي استنت طلب الاشتراك (`saveDeferredItems`) ترجع للسلة
      // — ودلوقتي هتاخد خصم المشترك لما الدفع يتأكد.
      for (const item of takeDeferredItems<CartItem>()) addItem(item);
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

      {/* ══ شريط الإجمالي على الموبايل ══════════════════════════
          على الشاشة الصغيرة ملخّص الطلب بييجي **تحت** النموذجين،
          فالعميل بيملا بياناته وهو مش شايف بيدفع كام. الشريط ده
          بيحط الرقم فوق، والملخّص الكامل فاضل تحت زيّ ما هو. */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span className="text-sm font-bold text-rose-900">
            {items.length.toLocaleString('ar-EG')}{' '}
            {items.length === 1 ? 'منتج' : 'منتجات'}
            {needsShipping && !shippingKnown ? ' — من غير الشحن' : ''}
          </span>
          <span className="text-xl font-black text-rose-700">{formatPrice(grandTotal)}</span>
        </div>
        {totalSavings > 0 && (
          <p className="mt-2 text-center text-sm font-black text-emerald-700">
            وفّرت {formatPrice(totalSavings)} في الطلب ده
          </p>
        )}
      </div>

      {/* Forms Section */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Step 1: Shipping */}
        {resumable && !placedOrder && (
          <div role="status" className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
            <p className="font-black">عندك طلب بنفس المحتويات اتسجّل ولسه مادفعتوش</p>
            <p className="mt-1 text-sm font-medium leading-relaxed">
              رقم الطلب <span className="font-mono font-bold" dir="ltr">{resumable.reference}</span> — المبلغ{' '}
              {formatPrice(resumable.total)}. تقدر تكمّل دفعه بدل ما يتسجّل طلب جديد.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resumeOrder}
                disabled={resuming || isPending}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {resuming ? 'لحظة…' : gateway ? `كمّل دفع الطلب ده (${formatPrice(resumable.total)})` : 'كمّل الطلب ده'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPendingOrder();
                  setResumable(null);
                }}
                disabled={resuming}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-bold text-blue-900 hover:bg-blue-100"
              >
                اعمل طلب جديد
              </button>
            </div>
            {orderError && <p className="mt-3 text-sm font-bold text-red-700">{orderError}</p>}
          </div>
        )}

        {addonConflicts.length > 0 && (
          <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <p className="font-black">
              {addonConflicts.length === 1 ? 'بند محتاج تعديل قبل الطلب' : 'بنود محتاجة تعديل قبل الطلب'}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed">
              النسخة الإلكترونية بتوصل على الإيميل من غير شحن، فالإضافات المطبوعة مابقتش بتتطلب معاها. عدّل البند واختار
              إضافات إلكترونية أو نسخة مطبوعة.
            </p>
            <ul className="mt-3 space-y-2">
              {addonConflicts.map((i: CartItem) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                  <span className="text-sm font-bold">{i.name}</span>
                  {i.productSlug && (
                    <Link
                      href={`/enha-lak/custom/${encodeURIComponent(i.productSlug)}?step=3&edit=${encodeURIComponent(i.id)}`}
                      className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-800 px-3 text-xs font-bold text-white hover:bg-amber-900"
                    >
                      عدّلها
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card accentColor="rose" className={`p-6 md:p-8 transition-all ${step === 1 ? 'border-rose-200 shadow-md' : 'bg-slate-50 opacity-60'}`}>
          <div className="flex items-center gap-4 mb-8">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${step === 1 ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'}`}>1</div>
            <h2 className="text-xl font-black text-slate-800">
              {needsShipping ? 'بيانات التوصيل' : 'بيانات التواصل'}
            </h2>
          </div>

          {step === 1 && (
            <form onSubmit={handleShippingSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="shipping-name" className="block text-sm font-bold text-slate-700 mb-2">الاسم بالكامل</label>
                  <input id="shipping-name" type="text" {...requiredFieldProps('الاسم بالكامل')} value={shippingInfo.name} onChange={e => setShippingInfo({...shippingInfo, name: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white" />
                </div>
                <div>
                  <label htmlFor="shipping-phone" className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف</label>
                  <input id="shipping-phone" type="tel"
                    inputMode="tel"
                    aria-invalid={phoneError ? true : undefined}
                    aria-describedby={phoneError ? 'shipping-phone-error' : undefined}
                    pattern={PHONE_INPUT_PROPS.pattern}
                    {...requiredFieldProps('رقم الهاتف')}
                    placeholder="٠١٠١٢٣٤٥٦٧٨"
                    value={shippingInfo.phone}
                    onChange={e => { setShippingInfo({...shippingInfo, phone: e.target.value}); if (phoneError) setPhoneError(''); }}
                    dir="ltr" className={`w-full rounded-xl border bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white text-right ${phoneError ? 'border-red-500' : 'border-slate-200'}`} />
                  {phoneError && <p id="shipping-phone-error" role="alert" className="mt-2 text-xs font-bold text-red-700">{phoneError}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="delivery-country" className="mb-2 block text-sm font-bold text-slate-700">
                  الدولة
                </label>
                <select
                  id="delivery-country"
                  required
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setShippingInfo({ ...shippingInfo, gov: '', city: '' });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white"
                >
                  {delivery.countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.nameAr}
                      {needsShipping && physicalClosedForCountry(delivery, c.code).closed ? ' — غير متاح الآن' : ''}
                    </option>
                  ))}
                </select>
                {delivery.countries.length === 0 && (
                  <p className="mt-2 text-xs font-bold text-amber-700">
                    تعذّر تحميل الدول المتاحة — حدّث الصفحة أو تواصل مع الإدارة.
                  </p>
                )}
                {countryClosed.closed && !needsShipping && (
                  <p role="status" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    {countryClosed.message || COUNTRY_CLOSED_MESSAGE}
                  </p>
                )}
                {electronicBlocked && electronicCheck && !electronicCheck.allowed && (
                  <p role="status" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    {electronicCheck.message}
                  </p>
                )}
              </div>

              {hasElectronic && (
                <div>
                  <label htmlFor="delivery-email" className="mb-2 block text-sm font-bold text-slate-700">
                    الإيميل اللي هتستلم عليه النسخة الإلكترونية
                  </label>
                  <input
                    id="delivery-email"
                    type="email"
                    {...requiredFieldProps('إيميل استلام النسخة الإلكترونية')}
                    dir="ltr"
                    aria-invalid={emailError ? true : undefined}
                    aria-describedby={emailError ? 'delivery-email-error' : undefined}
                    value={shippingInfo.email}
                    onChange={(e) => {
                      setShippingInfo({ ...shippingInfo, email: e.target.value });
                      if (emailError) setEmailError('');
                    }}
                    className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-right outline-none focus:border-rose-500 focus:bg-white ${emailError ? 'border-red-500' : 'border-slate-200'}`}
                  />
                  {emailError && (
                    <p id="delivery-email-error" role="alert" className="mt-2 text-xs font-bold text-red-700">
                      {emailError}
                    </p>
                  )}
                </div>
              )}

              {needsShipping && (<>
              {/* ══ اعتذار الشحن المقفول ════════════════════════
                  فوق الخانات، مش تحتها: العميل بيقرا قبل ما يكتب. */}
              {shippingOff && (
                <div
                  role="status"
                  className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900"
                >
                  <Truck className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-black">نعتذر — الشحن غير متاح حاليًا</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed">
                      {countryClosed.closed ? countryClosed.message || COUNTRY_CLOSED_MESSAGE : ''}
                    </p>
                    <p className="mt-2 text-sm font-medium leading-relaxed">
                      خانات التوصيل تحت مقفولة لحد ما يرجع، ومش محتاج تملاها.
                    </p>

                    {/* ══ الخروج ═══════════════════════════════════
                        ⚠️ **ده كان ناقص، وده كان العطل الحقيقي.**
                           كان مكتوب «تقدر تسيب النسخة الإلكترونية
                           وتكمّل» — والشرط اللي بيقرر ظهور الجملة دي
                           كان `cartHasElectronic`، وهي بترجّع صح
                           لبند «مطبوعة + إلكترونية» اللي **لسه محتاج
                           شحن**. يعني بنقول له سيب الإلكتروني وهو
                           مالوش بند إلكتروني.

                           وفوق ده مافيش زرار يعمل بيه حاجة. فالعميل
                           وصل لآخر خطوة ولقى زرار باهت وكلامًا
                           بيوصف حلًا مش موجود. */}
                    <div className="mt-4 rounded-xl bg-white/70 p-4">
                      <p className="text-sm font-black">
                        {blockers.length === 1
                          ? 'البند ده هو اللي محتاج شحن:'
                          : `${blockers.length.toLocaleString('ar-EG')} بنود محتاجة شحن:`}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {blockers.map((b) => (
                          <li
                            key={b.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2"
                          >
                            <span className="text-sm font-bold">
                              {b.name}
                              <span className="font-medium text-amber-800"> — {blockerLabel(b.reason)}</span>
                            </span>
                            <span className="flex gap-2">
                              {b.slug && (
                                <Link
                                  href={`/enha-lak/custom/${encodeURIComponent(b.slug)}`}
                                  className="inline-flex min-h-[44px] items-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900 hover:bg-amber-100"
                                >
                                  عدّلها
                                </Link>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  // نفس آلية تأجيل بنود الصندوق: بيترجعوا
                                  // للسلة بعد الطلب، فمفيش حاجة بتضيع.
                                  const item = items.find((i: CartItem) => i.id === b.id);
                                  if (item) saveDeferredItems([item]);
                                  removeItem(b.id);
                                }}
                                className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-800 px-3 text-xs font-bold text-white hover:bg-amber-900"
                              >
                                احفظها لوقت تاني
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-sm font-medium leading-relaxed">
                        {canOrderRemainder
                          ? 'اللي هتحفظه بيرجع لسلتك لما الشحن يفتح — وباقي الطلب يكمّل عادي دلوقتي.'
                          : 'لو حفظتهم كلهم، السلة هتفضي — وكل حاجة بترجع لها لما الشحن يفتح.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="shipping-address" className="block text-sm font-bold text-slate-700 mb-2">
                  العنوان بالتفصيل (الشارع، رقم العمارة، الشقة)
                </label>
                <input
                  id="shipping-address"
                  type="text"
                  {...requiredFieldProps('العنوان بالتفصيل')}
                  // ⚠️ `disabled` مش `readOnly`: المعطّلة بتخرج من فحص
                  //    المتصفح، فمافيش «الخانة دي مطلوبة» على خانة مقفولة.
                  disabled={shippingOff}
                  value={shippingInfo.address}
                  onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {shippingOff ? (
                /* الجزء المعطّل — شكله موجود عشان العميل يفهم إن ده
                   مكان الشحن ومقفول، مش إن الصفحة ناقصة. */
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-hidden="true">
                  {['المحافظة', 'المنطقة / المدينة'].map((label) => (
                    <div key={label}>
                      <label className="mb-2 block text-sm font-bold text-slate-400">{label}</label>
                      <div className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-medium text-slate-400">
                        غير متاح الآن
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="delivery-governorate" className="mb-2 block text-sm font-bold text-slate-700">
                    المحافظة
                  </label>
                  <select
                    id="delivery-governorate"
                    {...requiredFieldProps('المحافظة')}
                    value={shippingInfo.gov}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, gov: e.target.value, city: '' })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white"
                  >
                    <option value="">اختر المحافظة...</option>
                    {governoratesOf(delivery, country).map((g) => (
                      <option key={g.id} value={g.nameAr} disabled={!g.physicalEnabled}>
                        {g.nameAr}
                        {g.physicalEnabled ? '' : ' — غير متاح الآن'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="delivery-area" className="mb-2 block text-sm font-bold text-slate-700">
                    المنطقة / المدينة
                  </label>
                  <select
                    id="delivery-area"
                    {...requiredFieldProps('المنطقة / المدينة')}
                    disabled={!shippingInfo.gov}
                    value={shippingInfo.city}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white disabled:opacity-60"
                  >
                    <option value="">
                      {shippingInfo.gov ? 'اختر المنطقة...' : 'اختر المحافظة الأول'}
                    </option>
                    {areasOf(delivery, country, shippingInfo.gov).map((area) => (
                      <option key={area.city} value={area.city}>
                        {area.city} — {formatPrice(area.fee)}
                      </option>
                    ))}
                  </select>
                </div>
                {areaBlockedMessage && (
                  <p role="status" className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    {areaBlockedMessage}
                  </p>
                )}
                {delivery.rates.length === 0 && (
                  <p className="md:col-span-2 text-xs font-bold text-amber-700">
                    لم تُضبط مناطق الشحن بعد — تواصل مع الإدارة.
                  </p>
                )}
              </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    ملاحظات للتوصيل (اختياري)
                  </label>
                  <input
                    type="text"
                    disabled={shippingOff}
                    value={shippingInfo.notes}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
                    placeholder="علامة مميزة، أفضل وقت للتسليم…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-rose-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
              </>)}

              {/* ⚠️ **الزر المقفول لازم يقول هو مقفول ليه.** كان باهتًا
                  وبس، والعميل بيدوس ويدوس ومافيش حاجة بتحصل ولا سطر
                  بيشرح — وأغلب الناس بتفترض إن الموقع باظ، مش إن فيه
                  قرار إداري. السطر ده بيقول السبب والحل. */}
              <div className="pt-4 flex flex-col items-end gap-2">
                {orderError && (
                  <div role="alert" className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {orderError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!canContinue || mixedBox || isProcessing || isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-8 py-4 font-black text-white shadow-lg transition-colors hover:bg-rose-700 disabled:opacity-60 sm:w-auto"
                >
                  {isProcessing || isPending ? (
                    gateway ? 'لحظة — بنفتح صفحة الدفع…' : 'جارٍ تسجيل الطلب…'
                  ) : gateway ? (
                    <>
                      <CreditCard className="h-5 w-5" aria-hidden="true" /> ادفع {formatPrice(grandTotal)}
                    </>
                  ) : (
                    <>
                      سجّل الطلب واعرض بيانات التحويل <ChevronRight className="h-5 w-5 rotate-180" />
                    </>
                  )}
                </button>
                {gateway && canContinue && !mixedBox && (
                  <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    هتتحوّل لصفحة دفع آمنة ({gateway.methods.map((m) => METHOD_LABELS[m]).join(' · ')}). بيانات بطاقتك مابتعدّيش على موقعنا.
                  </p>
                )}
                {mixedBox && (
                  <p role="status" className="text-sm font-bold text-amber-800">
                    شيل المنتجات التانية من الملخّص عشان تكمّل الاشتراك — التفاصيل جنبها.
                  </p>
                )}
                {!canContinue && (
                  <p role="status" className="text-sm font-bold text-amber-800">
                    {/* ⚠️ الشرط كان `hasElectronic` — وهي بترجّع صح لبند
                        «مطبوعة + إلكترونية» اللي لسه محتاج شحن. السؤال
                        الصح: هيفضل حاجة تتطلب لو شلنا اللي محتاج شحن؟ */}
                    {shippingOff
                      ? canOrderRemainder
                        ? 'الشحن مقفول — احفظ البنود المعلَّمة فوق لوقت تاني، وباقي الطلب يكمّل عادي.'
                        : 'كل اللي في سلتك محتاج شحن، والشحن مقفول دلوقتي. احفظهم فوق وهما بيرجعوا لك لما يفتح.'
                      : electronicBlocked && electronicCheck && !electronicCheck.allowed
                        ? electronicCheck.message
                        : !shippingInfo.gov
                          ? 'اختار المحافظة والمنطقة الأول — سعر الشحن بيتحدّد منهم.'
                          : !shippingInfo.city
                            ? 'اختار المنطقة الأول — سعر الشحن بيتحدّد منها.'
                            : areaBlockedMessage || 'التوصيل للمكان ده غير متاح الآن — اختار منطقة تانية.'}
                  </p>
                )}
              </div>
            </form>
          )}
          {step === 2 && (
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-bold text-slate-800">{shippingInfo.name}</p>
                  {needsShipping && (
                    <p className="text-sm text-slate-600">
                      {shippingInfo.address}، {shippingInfo.city}، {shippingInfo.gov}
                      {delivery.countries.find((c) => c.code === country)?.nameAr
                        ? `، ${delivery.countries.find((c) => c.code === country)?.nameAr}`
                        : ''}
                    </p>
                  )}
                  {hasElectronic && (
                    <p className="text-sm text-slate-600" dir="ltr">{shippingInfo.email}</p>
                  )}
                </div>
              </div>
              {/* بعد تسجيل الطلب، التعديل هنا كان هيعمل طلب تاني. */}
              {!placedOrder && (
                <button onClick={() => setStep(1)} className="text-sm font-bold text-rose-600 hover:underline">تعديل</button>
              )}
            </div>
          )}
        </Card>

        {/* Step 2: Payment — بيظهر بس بعد تسجيل الطلب (بيانات التحويل، أو
            إعادة المحاولة لو صفحة البوابة مافتحتش). قبلها كان كارت باهت
            بيقول للعميل إن فيه خطوة كمان. */}
        {step === 2 && (
        <Card accentColor="rose" className="border-rose-200 p-6 shadow-md md:p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${step === 2 ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'}`}>2</div>
            <h2 className="text-xl font-black text-slate-800">طريقة الدفع</h2>
          </div>

          {placedOrder && gateway ? (
            <GatewayPayButton
              orderId={placedOrder.id}
              // ⚠️ إجمالي القاعدة، مش حساب الشاشة.
              amount={placedOrder.total ?? grandTotal}
              methods={gateway.methods}
              reference={placedOrder.reference}
            />
          ) : placedOrder ? (
            <>
              {manualNotice && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  {manualNotice}
                </div>
              )}
              <PaymentProofForm
                reference={placedOrder.reference}
                // ⚠️ إجمالي القاعدة، مش حساب الشاشة — هو اللي العميل لازم يحوّله.
                amount={placedOrder.total ?? grandTotal}
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
          ) : null}
        </Card>
        )}

      </div>

      {/* Order Summary Sidebar */}
      <div>
        <Card accentColor="rose" className="p-6 sticky top-8">
          <h3 className="text-lg font-black text-slate-800 mb-6">ملخص الطلب</h3>

          {/* ══ الصندوق بيتطلب لوحده ═══════════════════════════
              مكانه هنا فوق البنود: الكلام عن محتويات السلة،
              والزرار بيغيّر البنود اللي تحته على طول. */}
          {mixedBox && (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              <p className="leading-relaxed">
                اشتراك صندوق الرحلة بيتطلب لوحده. باقي المنتجات تستنى وترجع
                لسلتك بعد ما تخلص الاشتراك — وساعتها تاخد خصم المشترك على الإضافات.
              </p>
              <button
                type="button"
                onClick={() => {
                  const others = items.filter((i: CartItem) => !i.boxPlanId);
                  saveDeferredItems(others);
                  others.forEach((i: CartItem) => removeItem(i.id));
                }}
                className="mt-3 min-h-[44px] rounded-lg bg-amber-800 px-4 text-xs font-bold text-white hover:bg-amber-900"
              >
                اطلب الاشتراك الأول
              </button>
            </div>
          )}

          <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {items.map((item: any) => (
              <div key={item.id} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                {/* ⚠️ **البند من غير صورة كان بيطلّع أيقونة مكسورة.**
                    `optimizedImageUrl(undefined)` بترجّع `''`، و`<Image src="">`
                    بيرسم علامة الصورة المكسورة. واشتراك الصندوق تحديدًا
                    مالوش صورة منتج — فأول حاجة العميل بيشوفها في ملخّص
                    طلبه بـ٤١٩٠ جنيه صورة مكسورة.

                    صفحة السلة كانت بتتعامل مع الحالة دي صح من الأول
                    (`item.imageUrl ? … : <Package/>`) — والدفع لأ. */}
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-100 text-slate-400">
                  {item.imageUrl ? (
                    <Image src={optimizedImageUrl(item.imageUrl, 160)} alt={item.name} fill sizes="96px" className="object-cover" />
                  ) : (
                    <Package className="h-7 w-7" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1">
                  
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-2">{item.name}</h4>
                  {item.customizationData?.childName && (
                    <p className="text-xs text-slate-500 mt-1">الطفل: {item.customizationData.childName}</p>
                  )}

                  {/* ⚠️ **مفيش عدّاد كمية** (قرار تامر): كل بند قصة أو كتاب
                      متخصص لطفل بعينه — نسخة واحدة دايمًا. نسخة لطفل تاني
                      = تخصيص جديد = بند جديد. فاضل زرّ «حذف» بس، عشان اللي
                      ضاف حاجة بالغلط يقدر يشيلها من هنا. */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={isPending || isProcessing}
                      className="text-xs font-bold text-slate-600 hover:text-rose-700 disabled:opacity-40"
                    >
                      حذف
                    </button>
                    <span className="text-sm font-bold text-rose-600">{formatPrice(item.price)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ══ كود الخصم ════════════════════════════════════
              مكانه هنا جنب الأرقام اللي بيأثّر عليها، ومتاح من أول
              الصفحة مش من خطوة الدفع.

              ⚠️ **وبيتقفل بعد تسجيل الطلب**: القاعدة قفلت الإجمالي
                 ساعتها، فكود جديد مش هيعمل حاجة — وخانة شغّالة
                 مابتعملش حاجة أسوأ من خانة مقفولة بسبب مكتوب. */}
          <div className="mb-4">
            <DiscountCodeField
              line={boxItem ? 'box' : 'enha_lak'}
              value={discount}
              onChange={(v) => {
                setDiscount(v);
                setOrderError('');
              }}
              disabled={!discountRelevant || isProcessing || isPending}
            />
            {placedOrder && (
              <p className="mt-2 text-xs font-medium text-slate-500">
                الطلب اتسجّل بإجماله — كود الخصم مابيتغيّرش بعد كده.
              </p>
            )}
          </div>

          <div className="space-y-3 py-4 border-y border-slate-100 mb-4">
            <div className="flex justify-between text-sm text-slate-600">
              <span>المجموع الفرعي</span>
              <span className="font-bold">{formatPrice(subtotal)}</span>
            </div>
            {offerSavings > 0 && (
              <div className="flex justify-between text-sm text-slate-500">
                <span>قبل العرض</span>
                <span className="font-bold line-through">{formatPrice(listTotal)}</span>
              </div>
            )}
            {discountOff > 0 && discount && (
              <div className="flex justify-between text-sm font-bold text-emerald-800">
                <span>
                  خصم <span dir="ltr" className="font-mono">{discount.code}</span> ({discount.percent.toLocaleString('ar-EG')}٪)
                </span>
                <span>− {formatPrice(discountOff)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-600">
              <span>مصاريف الشحن</span>
              <span className="font-bold">
                {!needsShipping
                  ? 'لا ينطبق'
                  : shippingKnown
                    ? shipping === 0
                      ? 'مجاناً'
                      : boxItem
                        ? `${formatPrice(matchedFee ?? 0)} × ${boxMonths.toLocaleString('ar-EG')} = ${formatPrice(shipping)}`
                        : formatPrice(shipping)
                    : 'يُحدَّد حسب المنطقة'}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-black text-slate-800">الإجمالي</span>
            <span className="text-2xl font-black text-rose-600">{formatPrice(grandTotal)}</span>
          </div>

          {/* ══ التوفير ══════════════════════════════════════
              ملاحظة تامر: «اعرض التوفير المتحقق». العرض على المنتج
              وكود الخصم كانوا سطرين منفصلين بالسالب — ورقم واحد
              مجمّع بيقول الحكاية: «وفّرت ٨٥ ج.م». */}
          {totalSavings > 0 && (
            <div
              role="status"
              className="mb-6 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
            >
              <span className="text-sm font-black text-emerald-900">وفّرت في الطلب ده</span>
              <span className="text-lg font-black text-emerald-700">{formatPrice(totalSavings)}</span>
            </div>
          )}

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
