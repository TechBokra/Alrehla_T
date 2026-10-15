'use client';

import React, { useState } from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { BusyButton } from '@/components/forms/Form';
import { startGatewayPayment } from '@/actions/payments';
import { METHOD_LABELS, type GatewayMethod } from '@/lib/payments/settings';
import type { PaymentKind } from '@/lib/payments/xpay-event';

/**
 * زرار الدفع بالبوابة: بيفتح جلسة دفع وبيحوّل العميل لصفحة XPay.
 *
 * ⚠️ **الطلب ما بيتأكّدش هنا.** العميل لما يرجع من البوابة بيشوف «بنأكّد
 *    دفعتك»، والتأكيد الحقيقي بييجي من الويبهوك. لو أكّدنا من رجوع
 *    المتصفح، أي حد يفتح رابط الرجوع ياخد المنتج من غير ما يدفع.
 *
 * ⚠️ **مفيش خانة رقم بطاقة هنا ولا هتبقى.** بيانات البطاقة بتتكتب على
 *    صفحة XPay نفسها، فما بتعدّيش على خوادمنا أصلًا.
 */
export function GatewayPayButton({
  orderId,
  amount,
  methods,
  reference,
  kind = 'order',
  label = 'رقم الطلب',
}: {
  orderId: string;
  amount: number;
  methods: GatewayMethod[];
  reference: string;
  /** طلب منتج، خدمة كتابة، أو حجز باقة — بيحدد جدول القاعدة والدوال. */
  kind?: PaymentKind;
  /** «رقم الطلب» أو «رقم الحجز» — نفس الزرار في تلات شاشات. */
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await startGatewayPayment(orderId, kind);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      // بنسيب `busy` شغّال: الصفحة بتتنقل، والزرار مايتضغطش تاني.
      window.location.assign(result.url);
    } catch {
      setError('تعذّر فتح صفحة الدفع. جرّب تاني.');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-600">المبلغ المطلوب</span>
          <span className="text-2xl font-black text-slate-900">{formatPrice(amount)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-bold text-slate-600">{label}</span>
          <span className="font-mono text-sm font-bold text-slate-800" dir="ltr">
            {reference}
          </span>
        </div>
      </div>

      {methods.length > 0 && (
        <p className="text-sm font-medium text-slate-600">
          الوسائل المتاحة: {methods.map((m) => METHOD_LABELS[m]).join(' · ')}
        </p>
      )}

      <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          هتتحوّل لصفحة دفع آمنة. بيانات بطاقتك بتتكتب هناك ومابتعدّيش على موقعنا، وطلبك
          بيتأكّد تلقائيًا بعد الدفع.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <BusyButton busy={busy} pendingLabel="جارٍ التحويل لصفحة الدفع…" onClick={pay} className="w-full">
        <CreditCard className="h-5 w-5" aria-hidden="true" />
        ادفع {formatPrice(amount)}
      </BusyButton>
    </div>
  );
}
