'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award } from 'lucide-react';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, SubmitButton, TextInput } from '@/components/forms/Form';
import { requestPaperCertificate } from '@/actions/certificates';
import { CERTIFICATE_PARENT_LABELS, certificateViewable } from '@/lib/certificates';
import type { Certificate } from '@/data/domains/(shared)/certificates/queries';

/**
 * شهادات الإتمام لولي الأمر (٧ نوفمبر): الرقمية بتتفتح وتتطبع من هنا، والورقية
 * اختيارية بعنوانه.
 */
export function CertificatesSection({ certificates }: { certificates: Certificate[] }) {
  if (certificates.length === 0) return null;
  return (
    <section aria-labelledby="certs-h" className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/60 p-6">
      <h2 id="certs-h" className="flex items-center gap-2 text-lg font-black text-slate-900">
        <Award className="h-5 w-5 text-amber-600" aria-hidden="true" />
        شهادات الإتمام
      </h2>
      <ul className="space-y-3">
        {certificates.map((c) => (
          <CertificateItem key={c.id} c={c} />
        ))}
      </ul>
    </section>
  );
}

function CertificateItem({ c }: { c: Certificate }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{c.participantName}</p>
          <p className="text-sm font-medium text-slate-600">
            {c.packageName} — {CERTIFICATE_PARENT_LABELS[c.status]}
            {c.status === 'shipped' && c.trackingReference && (
              <>
                {' '}
                (رقم الشحنة <span dir="ltr">{c.trackingReference}</span>)
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {certificateViewable(c.status) && (
            <Link
              href={`/certificate/${c.id}`}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-5 font-bold text-white hover:bg-slate-800"
            >
              عرض وطباعة الشهادة
            </Link>
          )}
          {c.status === 'issued' && !asking && (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="min-h-[44px] rounded-xl border-2 border-slate-200 px-5 font-bold text-slate-700 hover:border-slate-400"
            >
              اطلب نسخة ورقية
            </button>
          )}
        </div>
      </div>

      {c.status === 'issued' && asking && (
        <ActionForm
          action={requestPaperCertificate}
          onDone={() => {
            setAsking(false);
            router.refresh();
          }}
          className="mt-4 space-y-4 border-t border-slate-100 pt-4"
        >
          <input type="hidden" name="id" value={c.id} />
          <p className="text-sm font-medium text-slate-600">هنطبعها ونشحنها على العنوان ده.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="اسم المستلم" name="recipientName" required>
              <TextInput name="recipientName" autoComplete="name" maxLength={80} />
            </Field>
            <Field label="رقم الموبايل" name="recipientPhone" required>
              <TextInput name="recipientPhone" type="tel" dir="ltr" autoComplete="tel" maxLength={30} />
            </Field>
            <Field label="العنوان بالتفصيل" name="addressLine" required className="md:col-span-2">
              <TextInput name="addressLine" autoComplete="street-address" maxLength={300} />
            </Field>
            <Field label="المدينة / المنطقة" name="city" required>
              <TextInput name="city" maxLength={80} />
            </Field>
            <Field label="المحافظة" name="governorate" required>
              <TextInput name="governorate" maxLength={80} />
            </Field>
            <Field label="ملاحظات للمندوب" name="notes" className="md:col-span-2">
              <TextInput name="notes" maxLength={300} />
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="min-h-[44px] rounded-xl px-5 font-bold text-slate-600 hover:underline"
            >
              إلغاء
            </button>
            <SubmitButton pendingLabel="جارٍ الإرسال…">اطلب النسخة الورقية</SubmitButton>
          </div>
        </ActionForm>
      )}
    </li>
  );
}
