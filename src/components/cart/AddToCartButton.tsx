'use client';
import React from 'react';
import Link from 'next/link';
import { ShoppingCart, Check } from 'lucide-react';
import { useCart, CartItem } from '@/context/CartContext';

/**
 * زرّ الإضافة للسلة.
 *
 * ── بلاغ فريق العمل: «الزر يقبل أكثر من مرة» ────────────────
 *
 * الزرّ كان بيتقفل ويفتح **بمؤقّت**:
 *
 *     setAdded(true);
 *     setTimeout(() => setAdded(false), 2000);
 *
 * يعني بعد تانيتين بيرجع «أضف للسلة» من غير ما يقول إن الصنف **جوّه
 * السلة أصلًا**. فاللي بيضغط تاني — وهو فاكر إن الأولى ما اشتغلتش —
 * بيزوّد الكمية في صمت. والعدّاد في الشريط بقى ٣ من غير ما حد يقصد.
 *
 * ⚠️ **والمؤقّت كان بيقيس الحاجة الغلط.** هو بيعبّر عن «عدّى وقت من
 *    الضغطة» — والسؤال الحقيقي هو «هو في السلة ولا لأ»، والإجابة
 *    موجودة في السلة نفسها. دلوقتي الحالة بتتقرا من السلة، فالزرّ
 *    مايقدرش يكدب.
 *
 * ⚠️ **وضغطة تانية بقت بتودّي للسلة لا بتزوّد الكمية.** تغيير الكمية
 *    شغل صفحة السلة — هناك العميل شايف الرقم وشايف الإجمالي بيتحرّك.
 *    زيادة مخفية ورا زرّ «أضف» بتبان بس في صفحة الدفع، لما يبقى فات
 *    الأوان.
 */
export function AddToCartButton({
  product,
  variant = 'primary',
  className = '',
}: {
  product: CartItem;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}) {
  const { addItem, items } = useCart();

  const inCart = items.find((i) => i.id === product.id);

  const baseClasses =
    'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-md transition-all';

  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'bg-amber-500 text-white hover:bg-amber-600',
    outline: 'border-2 border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
  };

  const selectedClass = variants[variant] || variants.primary;

  if (inCart) {
    return (
      <Link
        href="/enha-lak/checkout"
        className={`${baseClasses} bg-green-500 text-white hover:bg-green-600 ${className} w-full`}
      >
        <Check className="h-4 w-4" />
        في السلة{inCart.quantity > 1 ? ` (${inCart.quantity})` : ''} · عرض السلة
      </Link>
    );
  }

  return (
    <button
      onClick={() => addItem(product)}
      className={`${baseClasses} ${selectedClass} ${className} w-full`}
    >
      <ShoppingCart className="h-4 w-4" />
      أضف للسلة
    </button>
  );
}
