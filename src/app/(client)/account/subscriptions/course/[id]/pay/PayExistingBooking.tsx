'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PaymentProofForm } from '@/components/checkout/PaymentProofForm';
import { submitBookingPaymentProof } from '@/actions/bookings';

/** رفع إيصال لحجز اتسجّل قبل كده ومادفعش (صفحة `pay`). */
export function PayExistingBooking(props: {
  subscriptionId: string;
  reference: string;
  amount: number;
  walletNumber: string;
  qrUrl?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  return (
    <>
      <PaymentProofForm
        reference={props.reference}
        amount={props.amount}
        walletNumber={props.walletNumber}
        qrUrl={props.qrUrl}
        accent="emerald"
        busy={pending}
        onSubmit={(proof) =>
          start(async () => {
            setError('');
            const r = await submitBookingPaymentProof(props.subscriptionId, proof);
            if (!r.ok) {
              setError(r.error ?? 'تعذّر إرسال الإيصال');
              return;
            }
            router.push('/account/subscriptions/course');
            router.refresh();
          })
        }
      />
      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
