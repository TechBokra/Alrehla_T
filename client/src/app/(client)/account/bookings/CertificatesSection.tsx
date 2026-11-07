'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award } from 'lucide-react';
import { BusyButton, Field, Select, TextInput } from '@/components/forms/Form';
import { FormError, FormSuccess } from '@/components/ui/FormError';
import { cancelPaperCertificate, requestPaperCertificate } from '@/actions/certificates';
import { startGatewayPayment } from '@/actions/payments';
import { useAction } from '@/lib/use-action';
import { CERTIFICATE_PARENT_LABELS, certificateViewable } from '@/lib/certificates';
import type { Certificate } from '@/data/domains/(shared)/certificates/queries';
import type { DeliveryCatalog } from '@/data/domains/(shared)/shipping/types';

/**
 * شهادات الإتمام لولي الأمر (٧ نوفمبر): الرقمية مجانية وبتتفتح وتتطبع من هنا.
 * الورقية اختيارية — ولي الأمر بيدفع رسوم الشحن بس (حسب منطقته من جدول الشحن)،
 * أونلاين قبل الطباعة.
 */
export function CertificatesSection({
  certificates,
  catalog,
  justPaid,
}: {
  certificates: Certificate[];
  catalog: DeliveryCatalog;
  justPaid: boolean;
}) {
  if (certificates.length === 0) return null;
  return (
    <section aria-labelledby="certs-h" className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/60 p-6">
      <h2 id="certs-h" className="flex items-center gap-2 text-lg font-black text-slate-900">
        <Award className="h-5 w-5 text-amber-600" aria-hidden="true" />
        شهادات الإتمام
      </h2>
      {justPaid && <FormSuccess message="اتدفعت رسوم الشحن — هنطبع الشهادة ونبعتهالك، وهيوصلك إشعار أول ما تتشحن." />}
      <ul className="space-y-3">
        {certificates.map((c) => (
          <CertificateItem key={c.id} c={c} catalog={catalog} />
        ))}
      </ul>
    </section>
  );
}

const fee = (n: number) => `${n.toLocaleString('ar-EG')} ج`;

function CertificateItem({ c, catalog }: { c: Certificate; catalog: DeliveryCatalog }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  const pay = useAction(startGatewayPayment, {
    onSuccess: (r) => {
      if (r.ok) window.location.href = r.url;
    },
    fallbackError: 'تعذّر فتح صفحة الدفع — جرّب تاني',
  });
  const cancel = useAction(cancelPaperCertificate, {
    onSuccess: () => router.refresh(),
    fallbackError: 'تعذّر إلغاء الطلب',
  });

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

      {c.status === 'awaiting_payment' && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium leading-7 text-slate-700">
            الشهادة نفسها مجانية. رسوم شحنها لـ{c.city}، {c.governorate}:{' '}
            <strong>{fee(c.shippingFee ?? 0)}</strong> — بعد الدفع بنطبعها ونشحنها.
          </p>
          <div className="flex flex-wrap gap-2">
            <BusyButton busy={pay.pending} pendingLabel="جارٍ فتح الدفع…" onClick={() => pay.run(c.id, 'certificate')}>
              ادفع {fee(c.shippingFee ?? 0)}
            </BusyButton>
            <BusyButton
              busy={cancel.pending}
              variant="secondary"
              pendingLabel="جارٍ الإلغاء…"
              disabled={pay.pending}
              onClick={() => cancel.run(c.id)}
            >
              إلغاء / تعديل العنوان
            </BusyButton>
          </div>
          <FormError message={pay.error || cancel.error} />
        </div>
      )}

      {c.status === 'issued' && asking && (
        <PaperRequestForm
          id={c.id}
          catalog={catalog}
          onCancel={() => setAsking(false)}
          onPay={(id) => pay.run(id, 'certificate')}
          onDone={() => {
            setAsking(false);
            router.refresh();
          }}
          payError={pay.error}
          paying={pay.pending}
        />
      )}
    </li>
  );
}

function PaperRequestForm({
  id,
  catalog,
  onCancel,
  onPay,
  onDone,
  payError,
  paying,
}: {
  id: string;
  catalog: DeliveryCatalog;
  onCancel: () => void;
  onPay: (id: string) => void;
  onDone: () => void;
  payError: string;
  paying: boolean;
}) {
  const country = catalog.countries.find((c) => c.isDefault)?.code ?? 'EG';
  const governorates = catalog.governorates.filter((g) => g.countryCode === country && g.physicalEnabled);
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const cities = useMemo(
    () => catalog.rates.filter((r) => r.countryCode === country && r.governorate === governorate),
    [catalog.rates, country, governorate],
  );
  const quote = cities.find((r) => r.city === city)?.fee ?? null;

  const submit = useAction(requestPaperCertificate, {
    onSuccess: (r) => {
      if (!r.ok) return;
      // الطلب اتسجّل؛ لو فتح الدفع فشل، البند بيرجع يظهر «ادفع» بعد التحديث.
      if (r.needsPayment) onPay(id);
      onDone();
    },
    fallbackError: 'تعذّر إرسال الطلب',
  });

  if (catalog.pause.paused) {
    return (
      <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
        {catalog.pause.message || 'التوصيل متوقف مؤقتًا — جرّب بعدين.'}
      </p>
    );
  }

  return (
    <form
      className="mt-4 space-y-4 border-t border-slate-100 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('id', id);
        fd.set('country', country);
        submit.run(fd);
      }}
    >
      <p className="text-sm font-medium text-slate-600">
        الشهادة مجانية — بتدفع رسوم الشحن بس، وبتظهر لك قبل التأكيد.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="اسم المستلم" name="recipientName" required>
          <TextInput name="recipientName" autoComplete="name" maxLength={80} />
        </Field>
        <Field label="رقم الموبايل" name="recipientPhone" required>
          <TextInput name="recipientPhone" type="tel" dir="ltr" autoComplete="tel" maxLength={30} />
        </Field>
        <Field label="المحافظة" name="governorate" required>
          <Select
            name="governorate"
            value={governorate}
            onChange={(e) => {
              setGovernorate(e.target.value);
              setCity('');
            }}
          >
            <option value="">— اختار —</option>
            {governorates.map((g) => (
              <option key={g.id} value={g.nameAr}>
                {g.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المنطقة" name="city" required>
          <Select name="city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!governorate}>
            <option value="">— اختار —</option>
            {cities.map((r) => (
              <option key={r.city} value={r.city}>
                {r.city}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="العنوان بالتفصيل" name="addressLine" required className="md:col-span-2">
          <TextInput name="addressLine" autoComplete="street-address" maxLength={300} />
        </Field>
        <Field label="ملاحظات للمندوب" name="notes" className="md:col-span-2">
          <TextInput name="notes" maxLength={300} />
        </Field>
      </div>

      {quote !== null && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
          رسوم الشحن: {quote > 0 ? fee(Math.ceil(quote)) : 'مجانًا'}
        </p>
      )}

      <FormError message={submit.error || payError} />

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl px-5 font-bold text-slate-600 hover:underline">
          إلغاء
        </button>
        <button
          type="submit"
          disabled={submit.pending || paying || !city}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-8 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submit.pending || paying
            ? 'جارٍ التجهيز…'
            : quote && quote > 0
              ? `اطلب وادفع ${fee(Math.ceil(quote))}`
              : 'اطلب النسخة الورقية'}
        </button>
      </div>
    </form>
  );
}
