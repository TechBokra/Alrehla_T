'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PaymentProofForm } from '@/components/checkout/PaymentProofForm';
import { submitPaymentProof } from '@/actions/orders';

/** رفع إيصال لطلب اتسجّل قبل كده ومادفعش (صفحة `pay`). */
export function PayExistingOrder(props: {
  orderId: string;
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
        accent="rose"
        busy={pending}
        onSubmit={(payment) =>
          start(async () => {
            setError('');
            const r = await submitPaymentProof(props.orderId, payment);
            if (!r.success) {
              setError(r.error ?? 'تعذّر إرسال الإيصال');
              return;
            }
            router.push('/enha-lak/order-confirmation?id=' + props.orderId);
          })
        }
      />
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
    </>
  );
}
