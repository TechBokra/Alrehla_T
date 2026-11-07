'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { createCertificate } from '@/actions/certificates';
import { useAction } from '@/lib/use-action';
import { CERTIFICATE_STATUS_LABELS, type CertificateStatus } from '@/lib/certificates';

/**
 * شهادة الإتمام في صفحة الحجز: حالتها، أو زرار إنشاء يدوي لو المشارك خلّص
 * والجلسات ماتعلّمتش «اكتملت» (الإنشاء التلقائي بيعتمد على عدّ الجلسات).
 */
export function CertificatePanel({
  subscriptionId,
  status,
  bookingStatus,
}: {
  subscriptionId: string;
  status: CertificateStatus | null;
  bookingStatus: string;
}) {
  const router = useRouter();
  const create = useAction(createCertificate, {
    onSuccess: () => router.refresh(),
    fallbackError: 'تعذّر إنشاء الشهادة',
  });

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <p className="mb-2 font-black text-slate-900">شهادة الإتمام</p>
      {status ? (
        <p className="text-sm font-medium text-slate-700">
          الحالة: <strong>{CERTIFICATE_STATUS_LABELS[status]}</strong> —{' '}
          <Link href="/dashboard/admin/bookings/certificates" className="font-bold text-blue-700 hover:underline">
            صفحة الشهادات
          </Link>
        </p>
      ) : bookingStatus === 'active' || bookingStatus === 'completed' ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            بتتعمل لوحدها لما كل جلسات الباقة تتعلّم «اكتملت». لو المشارك خلّص فعلًا والجلسات مش متعلّمة، اعملها من هنا.
          </p>
          <BusyButton busy={create.pending} variant="secondary" onClick={() => create.run(subscriptionId)}>
            إنشاء الشهادة الآن
          </BusyButton>
          <FormError message={create.error} />
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-600">بتتعمل بعد تأكيد الحجز وانتهاء جلساته.</p>
      )}
    </div>
  );
}
