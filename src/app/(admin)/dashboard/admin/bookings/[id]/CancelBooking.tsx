'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { cancelBooking } from '@/actions/bookings';
import { useAction } from '@/lib/use-action';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

/**
 * إلغاء الحجز — **الطريق الوحيد**، فمحتاج يبقى واضح وصعب بالغلط.
 *
 * ── ليه خطوتين وسبب مكتوب ───────────────────────────────────
 *
 * الإلغاء بيشيل جلسات الحجز اللي لسه ماحصلتش من تقويم المدرب
 * والطالب، وبيرجّع كود الخصم. ومفيش «تراجع» بعده: الجلسات
 * الملغية مابترجعش لوحدها.
 *
 * والسبب بيوصل للعميل في الإشعار — فالخانة دي مش توثيق داخلي،
 * دي الجملة اللي هيقراها.
 */
export function CancelBooking({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');

  const cancel = useAction(cancelBooking, {
    onSuccess: (result) => {
      if (!result.ok) return;
      setConfirming(false);
      setReason('');
      setDone(
        result.sessionsCancelled > 0
          ? `اتلغى الحجز، ومعاه ${result.sessionsCancelled.toLocaleString('ar-EG')} جلسة لسه ماحصلتش.`
          : 'اتلغى الحجز.',
      );
      router.refresh();
    },
    fallbackError: 'تعذّر إلغاء الحجز.',
  });

  // المكتمل والملغي مالهمش إلغاء.
  if (status === 'cancelled' || status === 'completed') return null;

  const wasPaid = status === 'active';

  if (done) {
    return (
      <p role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
        {done}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/50 p-5">
      <FormError message={cancel.error} />

      {confirming ? (
        <>
          <p className="font-black text-red-900">تلغي الحجز ده؟</p>

          {/* ⚠️ التحذير ده مش تزيين: الحجز المدفوع معناه فلوس وصلت،
              والإلغاء لوحده مابيرجّعهاش. */}
          {wasPaid && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              الحجز ده <strong>مدفوع</strong>. الإلغاء مش بيرجّع الفلوس — رتّب الاسترداد
              بنفسك بعد كده.
            </p>
          )}

          <p className="text-sm font-medium text-red-900">
            الجلسات اللي لسه ماحصلتش هتتلغي وتختفي من تقويم المدرب ومن لوحة الطالب،
            وكود الخصم هيرجع للعميل. الجلسات المكتملة هتفضل زيّ ما هي.
          </p>

          <Field
            label="سبب الإلغاء"
            hint="بيوصل للعميل في الإشعار — اكتبه بصيغة يقراها هو."
          >
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="مثال: بناءً على طلبك بالتليفون"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <BusyButton
              busy={cancel.pending}
              variant="danger"
              pendingLabel="جارٍ الإلغاء…"
              onClick={() => cancel.run(subscriptionId, reason)}
            >
              نعم، الغِ الحجز
            </BusyButton>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                cancel.clearError();
              }}
              disabled={cancel.pending}
              className="text-sm font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              تراجع
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            cancel.clearError();
          }}
          className="flex items-center gap-2 text-sm font-bold text-red-700 hover:text-red-900"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          إلغاء الحجز
        </button>
      )}
    </div>
  );
}
