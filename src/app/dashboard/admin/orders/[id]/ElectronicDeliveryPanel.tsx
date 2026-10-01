'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2, Copy } from 'lucide-react';
import { markElectronicSent } from '@/actions/admin-orders';
import { FormError } from '@/components/ui/FormError';
import { formatDate } from '@/lib/utils';

/**
 * النسخة الإلكترونية (ملف 138): الإيميل + «تم الإرسال».
 *
 * الإرسال نفسه **يدوي** (قرار تامر): الإدارة بتبعت الملف من إيميل
 * المنصة، وبعدين تدوس هنا — فالعميل بياخد إشعار ويشوفها في «طلباتي».
 */
export function ElectronicDeliveryPanel({
  orderId,
  email,
  sentAt,
  paid,
}: {
  orderId: string;
  email: string;
  sentAt?: string;
  /** قبل تأكيد الدفع الزرار مقفول — مانبعتش ملفًا لطلب مادفعش. */
  paid: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  return (
    <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
        <Mail className="h-5 w-5" aria-hidden /> النسخة الإلكترونية
      </h3>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-mono font-bold text-slate-900" dir="ltr">{email}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(email).then(() => setCopied(true)).catch(() => {});
          }}
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? 'اتنسخ' : 'نسخ'}
        </button>
      </div>

      {sentAt ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> اتبعتت {formatDate(sentAt)}
        </p>
      ) : (
        <div className="mt-4">
          <FormError message={error} />
          <button
            type="button"
            disabled={!paid || pending}
            onClick={() =>
              start(async () => {
                setError('');
                const r = await markElectronicSent(orderId);
                if (!r.ok) setError(r.error);
                else router.refresh();
              })
            }
            className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pending ? 'جارٍ التسجيل…' : 'تم إرسال النسخة الإلكترونية'}
          </button>
          {!paid && (
            <p className="mt-2 text-xs font-bold text-slate-700">بعد تأكيد الدفع.</p>
          )}
        </div>
      )}
    </div>
  );
}
