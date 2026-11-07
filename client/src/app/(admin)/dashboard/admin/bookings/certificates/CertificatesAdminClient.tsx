'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BusyButton, TextInput } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';
import { deliverCertificate, issueCertificate, shipCertificate } from '@/actions/certificates';
import { useAction } from '@/lib/use-action';
import { CERTIFICATE_STATUSES, CERTIFICATE_STATUS_LABELS, type CertificateStatus } from '@/lib/certificates';
import { formatCairo } from '@/lib/timezone';
import type { Certificate } from '@/data/domains/(shared)/certificates/queries';

const BADGE: Record<CertificateStatus, StatusBadgeType> = {
  pending: 'pending',
  issued: 'success',
  print_requested: 'warning',
  shipped: 'info',
  delivered: 'success',
};

const day = (iso: string) => formatCairo(iso, { dateStyle: 'medium' });

export function CertificatesAdminClient({ certificates }: { certificates: Certificate[] }) {
  // الافتراضي: اللي محتاج شغل (إصدار أو طباعة أو شحن).
  const [filter, setFilter] = useState<CertificateStatus | 'work' | 'all'>('work');
  const needsWork = (c: Certificate) => c.status === 'pending' || c.status === 'print_requested' || c.status === 'shipped';
  const shown = certificates.filter((c) => (filter === 'all' ? true : filter === 'work' ? needsWork(c) : c.status === filter));
  const count = (f: CertificateStatus) => certificates.filter((c) => c.status === f).length;

  const chips: { id: CertificateStatus | 'work' | 'all'; label: string; n: number }[] = [
    { id: 'work', label: 'محتاج شغل', n: certificates.filter(needsWork).length },
    ...CERTIFICATE_STATUSES.map((s) => ({ id: s, label: CERTIFICATE_STATUS_LABELS[s], n: count(s) })),
    { id: 'all', label: 'الكل', n: certificates.length },
  ];

  return (
    <div className="space-y-5">
      <nav aria-label="فلترة الشهادات" className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            aria-pressed={filter === c.id}
            className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-bold ${
              filter === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {c.label} ({c.n})
          </button>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-sm font-bold text-slate-600">
          {certificates.length === 0
            ? 'مفيش شهادات لسه. أول ما مشارك يخلّص جلسات باقته، شهادته هتظهر هنا.'
            : 'مفيش شهادات في الفلتر ده.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => (
            <CertificateCard key={c.id} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CertificateCard({ c }: { c: Certificate }) {
  const router = useRouter();
  const done = { onSuccess: () => router.refresh() };
  const issue = useAction(issueCertificate, { ...done, fallbackError: 'تعذّر إصدار الشهادة' });
  const ship = useAction(shipCertificate, { ...done, fallbackError: 'تعذّر تسجيل الشحن' });
  const deliver = useAction(deliverCertificate, { ...done, fallbackError: 'تعذّر تسجيل التسليم' });
  const [name, setName] = useState(c.participantName);
  const [tracking, setTracking] = useState('');

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-black text-slate-900">{c.participantName}</p>
          <p className="text-sm font-medium text-slate-600">
            {c.packageName} · خلّص {day(c.completedAt)}
            {c.certificateNo && (
              <>
                {' '}
                · <span dir="ltr">{c.certificateNo}</span>
              </>
            )}
          </p>
          <Link href={`/dashboard/admin/bookings/${c.subscriptionId}`} className="text-xs font-bold text-blue-700 hover:underline">
            الحجز
          </Link>
        </div>
        <StatusBadge type={BADGE[c.status]} label={CERTIFICATE_STATUS_LABELS[c.status]} />
      </div>

      {(c.status === 'print_requested' || c.status === 'shipped' || c.status === 'delivered') && c.addressLine && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
          <p className="font-bold text-slate-900">الشحن إلى</p>
          <p>
            {c.recipientName} — <span dir="ltr">{c.recipientPhone}</span>
          </p>
          <p>
            {c.addressLine}، {c.city}، {c.governorate}
          </p>
          {c.shippingNotes && <p className="text-slate-500">ملاحظات: {c.shippingNotes}</p>}
          {c.paperRequestedAt && <p className="text-xs text-slate-500">اتطلبت {day(c.paperRequestedAt)}</p>}
          {c.trackingReference && (
            <p>
              رقم الشحنة: <span dir="ltr">{c.trackingReference}</span>
            </p>
          )}
        </div>
      )}

      <FormError message={issue.error || ship.error || deliver.error} className="mt-3" />

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        {c.status === 'pending' && (
          <>
            <label className="min-w-[16rem] flex-1 space-y-1 text-sm font-bold text-slate-700">
              الاسم كما سيُطبع في الشهادة
              <TextInput
                value={name}
                maxLength={80}
                onChange={(e) => {
                  setName(e.target.value);
                  issue.clearError();
                }}
              />
            </label>
            <BusyButton busy={issue.pending} pendingLabel="جارٍ الإصدار…" onClick={() => issue.run(c.id, name)}>
              إصدار الشهادة
            </BusyButton>
          </>
        )}
        {c.status !== 'pending' && (
          <Link
            href={`/certificate/${c.id}`}
            target="_blank"
            className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-slate-200 px-5 font-bold text-slate-700 hover:border-slate-400"
          >
            عرض / طباعة
          </Link>
        )}
        {c.status === 'print_requested' && (
          <>
            <label className="min-w-[12rem] space-y-1 text-sm font-bold text-slate-700">
              رقم الشحنة (اختياري)
              <TextInput value={tracking} dir="ltr" maxLength={80} onChange={(e) => setTracking(e.target.value)} />
            </label>
            <BusyButton busy={ship.pending} onClick={() => ship.run(c.id, tracking)}>
              اتطبعت واتشحنت
            </BusyButton>
          </>
        )}
        {c.status === 'shipped' && (
          <BusyButton busy={deliver.pending} onClick={() => deliver.run(c.id)}>
            اتسلّمت ✓
          </BusyButton>
        )}
      </div>
    </li>
  );
}
