'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, PackageCheck, Package, X, Check } from 'lucide-react';
import { setOrderFulfilmentStatus } from '@/actions/admin-orders';
import type { PublisherEarningsResult } from '@/actions/admin-orders';
import { FormError, FormSuccess, FormNotice } from '@/components/ui/FormError';
import { formatPrice } from '@/lib/utils';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

type Step = 'preparing' | 'shipped' | 'delivered' | 'cancelled';

/**
 * Moving the order through fulfilment.
 *
 * The button here used to have no handler at all, and there were no shipped
 * or delivered states in the database to move to — so a paid order stayed
 * "مدفوع" for ever and the customer was never told anything.
 */
export function FulfilmentPanel({
  orderId,
  status,
  trackingReference,
}: {
  orderId: string;
  status: string;
  trackingReference: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  // نتيجة تسجيل مستحقات الناشرين — بتتعرض، مش بتترمي.
  const [payouts, setPayouts] = useState<PublisherEarningsResult>(null);
  const [tracking, setTracking] = useState(trackingReference);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const closed = ['delivered', 'cancelled', 'refunded'].includes(status);
  const canFulfil = ['paid', 'preparing', 'shipped'].includes(status);

  const apply = async (target: Step) => {
    setBusy(true);
    setError('');
    setPayouts(null);
    try {
      // ⚠️ **النتيجة بتتقري.** «تم التسليم» على طلب فيه كتب ناشرين
      //    بيسجّل مستحقاتهم — ولو ما اتسجّلوش، الإدارة لازم تعرف
      //    دلوقتي. الشاشة كانت بترمي الرد في الزبالة.
      const result = await setOrderFulfilmentStatus({
        orderId,
        status: target,
        trackingReference: target === 'shipped' ? tracking : undefined,
        note: note.trim() || undefined,
      });
      setPayouts(result?.payouts ?? null);
      setStep(null);
      setNote('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحديث الحالة');
    } finally {
      setBusy(false);
    }
  };

  if (closed) return null;

  return (
    <div className="w-full space-y-3">
      <FormError message={error} />

      {payouts?.failed && (
        <FormError message="الطلب اتسلّم، بس تسجيل مستحقات الناشرين وقع. علّم الطلب «تم التسليم» تاني — إعادة التسجيل آمنة ومش بتدفع مرتين." />
      )}

      {payouts && !payouts.failed && (payouts.missing_cost ?? 0) > 0 && (
        <FormNotice
          message={
            `الطلب اتسلّم، بس فيه ${payouts.missing_cost} ناشر منتجه بلا «نصيب الناشر» مسجَّل — `
            + 'فمستحقه ما اتحسبش. اظبط النصيب من شاشة المنتجات وعلّم الطلب «تم التسليم» تاني.'
          }
        />
      )}

      {payouts?.recorded && (
        <FormSuccess
          message={
            `اتسجّل مستحق لـ${payouts.publishers} ناشر بإجمالي ${formatPrice(payouts.amount ?? 0)}.`
          }
        />
      )}

      <div className="flex flex-wrap gap-2">
        {canFulfil && status === 'paid' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => apply('preparing')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <Package className="h-4 w-4" /> بدأ التجهيز
          </button>
        )}

        {canFulfil && status !== 'shipped' && (
          <button
            type="button"
            onClick={() => setStep(step === 'shipped' ? null : 'shipped')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Truck className="h-4 w-4" /> تم الشحن
          </button>
        )}

        {status === 'shipped' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => apply('delivered')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <PackageCheck className="h-4 w-4" /> تم التسليم
          </button>
        )}

        <button
          type="button"
          onClick={() => setStep(step === 'cancelled' ? null : 'cancelled')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-5 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
        >
          <X className="h-4 w-4" /> إلغاء الطلب
        </button>
      </div>

      {step === 'shipped' && (
        <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <label className="text-xs font-bold text-blue-900">
            رقم الشحنة أو اسم شركة الشحن (يصل للعميل)
          </label>
          <input
            className={inputClass}
            dir="ltr"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="مثال: بوسطة — EG123456789"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => apply('shipped')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> تأكيد الشحن
            </button>
          </div>
        </div>
      )}

      {step === 'cancelled' && (
        <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <label className="text-xs font-bold text-rose-900">سبب الإلغاء (يصل للعميل)</label>
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => apply('cancelled')}
              className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              تأكيد الإلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
