'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, X } from 'lucide-react';
import { cancelMyOrder } from '@/actions/orders';
import { cancelMyBooking } from '@/actions/bookings';
import { cancelMyServiceOrder } from '@/actions/service-orders';

/**
 * نوع الشيء المعلّق — التلاتة بيتعملوا قبل الدفع ونفس العطل بيحصل
 * فيهم، فنفس الزرارين بيخدموهم بدالة إلغاء مختلفة لكل واحد.
 */
export type PendingKind = 'order' | 'booking' | 'service_order';

const CANCEL: Record<PendingKind, (id: string) => Promise<{ ok: boolean; error?: string }>> = {
  order: cancelMyOrder,
  booking: cancelMyBooking,
  service_order: cancelMyServiceOrder,
};

/** «الطلب» للمنتجات والخدمات، و«الحجز» للباقات. */
const NOUN: Record<PendingKind, string> = {
  order: 'الطلب',
  booking: 'الحجز',
  service_order: 'الطلب',
};

/**
 * «أكمل الدفع» و«ألغِ الطلب» على طلب لسه مادفعش.
 *
 * ── ليه الإلغاء لازم يكون هنا ───────────────────────────────
 *
 * الطلب بيتسجّل قبل الدفع عشان ياخد رقمًا مرجعيًا، فكل محاولة دفع ما
 * كملتش بتسيب طلب «بانتظار الدفع» في حساب العميل. من غير زرار إلغاء،
 * الحساب بيمتلي بطلبات مش محتاجها، ومفيش قدامه غير إنه يستنى الإلغاء
 * التلقائي أو يكلّم الدعم.
 *
 * ⚠️ الضغطة الأولى بتطلب تأكيد والتانية بتلغي — الإلغاء مالوش رجعة.
 * ⚠️ القاعدة هي اللي بتتأكد إن الطلب بتاعه ولسه مش مدفوع.
 */
export function PendingOrderActions({
  orderId,
  payHref,
  /** بوابة دفع شغّالة = «أكمل الدفع»؛ تحويل بنكي = «ادفع وارفع الإيصال». */
  gateway,
  kind = 'order',
}: {
  orderId: string;
  /**
   * صفحة إكمال الدفع. فاضية = مفيش صفحة دفع للنوع ده لسه، فبيظهر
   * الإلغاء وحده — وده أحسن من زرار بيودّي لحتة مش موجودة.
   */
  payHref?: string;
  gateway: boolean;
  /** طلب منتج، حجز باقة، أو طلب خدمة. */
  kind?: PendingKind;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await CANCEL[kind](orderId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError('تعذّر إلغاء الطلب. جرّب تاني.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {payHref && (
          <Link
            href={payHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-800"
          >
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            {gateway ? 'أكمل الدفع' : 'ادفع وارفع الإيصال'}
          </Link>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => (confirming ? void cancel() : setConfirming(true))}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
            confirming
              ? 'border-red-300 bg-red-600 text-white hover:bg-red-700'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {busy ? 'جارٍ الإلغاء…' : confirming ? 'اضغط تاني للتأكيد' : `إلغاء ${NOUN[kind]}`}
        </button>
      </div>

      {confirming && !busy && (
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs font-bold text-slate-500 underline"
        >
          تراجع
        </button>
      )}

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
