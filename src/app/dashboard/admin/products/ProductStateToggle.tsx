'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, Eye, Loader2 } from 'lucide-react';
import { setProductActive } from '@/actions/products';
import { FormError } from '@/components/ui/FormError';

/**
 * إيقاف منتج عن العرض — أو رجوعه.
 *
 * ── ليه الشاشة بتقول «إيقاف» مش «حذف» ───────────────────────
 *
 * ⚠️ **الحذف بيضيّع تاريخ الطلبات.** بنود الطلبات القديمة مربوطة
 *    بالمنتج، وحذفه بيخلّي طلبًا اتدفع تمنه يبان بلا منتج.
 *
 *    والجدول كان **مالوش مفتاح إيقاف أصلًا** (SQL 121)، فالاختيار
 *    كان: تسيب الغلط ظاهر للعميل، أو تمسح تاريخ الطلبات.
 *
 * ⚠️ **والشاشة بتسرد التلات آثار بدل ما تسمّي الإجراء.** «إيقاف»
 *    لوحدها ممكن تتقري «إخفاء من اللوحة» — والفرق بينها وبين
 *    «العميل مش هيقدر يشتريه» هو الفرق كله.
 */
export function ProductStateToggle({
  productId,
  productName,
  isActive,
}: {
  productId: string;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');

  const run = () => {
    if (isActive) {
      const sure = window.confirm(
        `هتوقف «${productName}» عن العرض.\n\n` +
          '• هيختفي من المكتبة وصفحة الناشر وخريطة الموقع\n' +
          '• صفحته هترجّع «غير موجود»\n' +
          '• وأي طلب جديد فيه هيترفض — حتى من سلة قديمة مفتوحة\n\n' +
          'الطلبات القديمة بتفضل زي ما هي.\n\nتأكيد؟',
      );
      if (!sure) return;
    }

    startTransition(async () => {
      setError('');
      const result = await setProductActive(productId, !isActive);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section
      className={`mt-8 rounded-2xl border p-5 ${
        isActive ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <h2
        className={`mb-2 flex items-center gap-2 font-black ${
          isActive ? 'text-slate-800' : 'text-amber-900'
        }`}
      >
        {isActive ? (
          <Eye className="h-5 w-5 text-slate-400" />
        ) : (
          <EyeOff className="h-5 w-5" />
        )}
        {isActive ? 'المنتج معروض للبيع' : 'المنتج موقوف'}
      </h2>

      <p
        className={`mb-4 text-sm leading-relaxed font-medium ${
          isActive ? 'text-slate-600' : 'text-amber-900'
        }`}
      >
        {isActive ? (
          <>
            الإيقاف بيشيله من المكتبة وخريطة الموقع، وبيخلّي صفحته ترجّع «غير
            موجود»، <strong className="text-slate-800">وبيرفض أي طلب جديد فيه</strong>{' '}
            — حتى من سلة قديمة مفتوحة في متصفح عميل. والطلبات القديمة بتفضل زي
            ما هي.
          </>
        ) : (
          <>
            مخفي من الموقع ومرفوض في الطلبات الجديدة. الطلبات القديمة اللي فيه
            بتفضل زي ما هي.
          </>
        )}
      </p>

      <FormError message={error} />

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition-colors disabled:opacity-50 ${
          isActive
            ? 'border-2 border-amber-300 text-amber-800 hover:border-amber-500'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        {isActive ? 'أوقف العرض' : 'رجّعه للعرض'}
      </button>
    </section>
  );
}
