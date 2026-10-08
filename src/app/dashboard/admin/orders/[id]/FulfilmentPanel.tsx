'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, PackageCheck, Package, X, Check } from 'lucide-react';
import { setOrderFulfilmentStatus } from '@/actions/admin-orders';
import type { PublisherEarningsResult } from '@/actions/admin-orders';
import { FormError, FormSuccess, FormNotice } from '@/components/ui/FormError';
import { formatPrice } from '@/lib/utils';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';

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
  // الخطوة اللي شغّالة دلوقتي — زرارها بس اللي بيكتب «جارٍ…»، والباقي بيتقفل.
  const [busyStep, setBusyStep] = useState<Step | null>(null);
  const busy = busyStep !== null;
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<string | undefined>();

  const closed = ['delivered', 'cancelled', 'refunded'].includes(status);
  const canFulfil = ['paid', 'preparing', 'shipped'].includes(status);

  const apply = async (target: Step) => {
    if (busy) return;
    setBusyStep(target);
    setError('');
    setErrorField(undefined);
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
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      setPayouts(result.payouts ?? null);
      setStep(null);
      setNote('');
      router.refresh();
    } catch {
      setError('تعذّر تحديث الحالة');
    } finally {
      setBusyStep(null);
    }
  };

  if (closed) return null;

  return (
    <div className="w-full space-y-3">
      {/* خطأ الخانة بيظهر تحتها؛ الباقي هنا. */}
      <FormError message={errorField ? '' : error} />

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
          <BusyButton
            busy={busyStep === 'preparing'}
            pendingLabel="جارٍ التحديث…"
            disabled={busy}
            onClick={() => apply('preparing')}
          >
            <Package className="h-4 w-4" /> بدأ التجهيز
          </BusyButton>
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
          <BusyButton
            busy={busyStep === 'delivered'}
            pendingLabel="جارٍ التحديث…"
            disabled={busy}
            onClick={() => apply('delivered')}
          >
            <PackageCheck className="h-4 w-4" /> تم التسليم
          </BusyButton>
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
          <Field label="رقم الشحنة أو اسم شركة الشحن (يصل للعميل)">
            <TextInput
              dir="ltr"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="مثال: بوسطة — EG123456789"
            />
          </Field>
          <div className="flex justify-end">
            <BusyButton
              busy={busyStep === 'shipped'}
              pendingLabel="جارٍ التحديث…"
              disabled={busy}
              onClick={() => apply('shipped')}
            >
              <Check className="h-4 w-4" /> تأكيد الشحن
            </BusyButton>
          </div>
        </div>
      )}

      {step === 'cancelled' && (
        <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <Field
            label="سبب الإلغاء (يصل للعميل)"
            required
            error={errorField === 'note' ? error : undefined}
          >
            <TextInput name="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <BusyButton
              variant="danger"
              busy={busyStep === 'cancelled'}
              pendingLabel="جارٍ الإلغاء…"
              disabled={busy}
              onClick={() => apply('cancelled')}
            >
              تأكيد الإلغاء
            </BusyButton>
          </div>
        </div>
      )}
    </div>
  );
}
