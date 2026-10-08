'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageCircle, Phone, User } from 'lucide-react';
import type { SupportSessionRequest } from '@/types';
import { formatDate } from '@/lib/utils';
import { setSessionRequestStatus, type SessionRequestStatus } from '@/actions/support';
import { StatusBadge } from '@/components/StatusBadge';
import { FormError } from '@/components/ui/FormError';
import { BusyButton } from '@/components/forms/Form';

const STATUS: Record<SessionRequestStatus, { label: string; type: 'warning' | 'info' | 'success' }> = {
  pending: { label: 'مستني رد', type: 'warning' },
  contacted: { label: 'اتواصلنا', type: 'info' },
  resolved: { label: 'اتحلّ', type: 'success' },
};

/** رقم مصري ← رابط واتساب دولي (01xxxxxxxxx ← 201xxxxxxxxx). */
function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('0') ? `2${digits}` : digits;
  return `https://wa.me/${intl}`;
}

export function SessionRequestsClient({ requests }: { requests: SupportSessionRequest[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  // الزرار اللي اتداس (`id:status`) — هو بس اللي يكتب «جارٍ الحفظ…».
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const shown = filter === 'open' ? requests.filter((r) => r.status !== 'resolved') : requests;

  const setStatus = (id: string, status: SessionRequestStatus) => {
    setActiveKey(`${id}:${status}`);
    startTransition(async () => {
      setError('');
      try {
        const result = await setSessionRequestStatus(id, status);
        if (!result.ok) setError(result.error);
        else router.refresh();
      } catch {
        setError('حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.');
      }
    });
  };

  const isBusy = (id: string, status: SessionRequestStatus) => pending && activeKey === `${id}:${status}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ['open', `المفتوحة (${requests.filter((r) => r.status !== 'resolved').length})`],
            ['all', `الكل (${requests.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              filter === key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <FormError message={error} />

      {shown.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
          مفيش طلبات {filter === 'open' ? 'مفتوحة' : ''}.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-800">{r.contactName}</h3>
                  <StatusBadge type={STATUS[r.status]?.type ?? 'warning'} label={STATUS[r.status]?.label ?? r.status} />
                </div>
                <span className="text-xs font-bold text-slate-500">{formatDate(r.createdAt)}</span>
              </div>

              <p className="text-sm leading-relaxed font-medium whitespace-pre-line text-slate-700">{r.message}</p>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <a
                  href={`tel:${r.contactPhone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  dir="ltr"
                >
                  <Phone className="h-4 w-4" /> {r.contactPhone}
                </a>
                <a
                  href={whatsappHref(r.contactPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  <MessageCircle className="h-4 w-4" /> واتساب
                </a>
                {r.userId && (
                  <Link
                    href={`/dashboard/admin/users/${r.userId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <User className="h-4 w-4" /> حسابه
                  </Link>
                )}

                <div className="ms-auto flex flex-wrap gap-2">
                  {r.status !== 'contacted' && r.status !== 'resolved' && (
                    <BusyButton
                      busy={isBusy(r.id, 'contacted')}
                      disabled={pending}
                      onClick={() => setStatus(r.id, 'contacted')}
                      className="text-sm"
                    >
                      اتواصلت معاه
                    </BusyButton>
                  )}
                  {r.status !== 'resolved' ? (
                    <BusyButton
                      busy={isBusy(r.id, 'resolved')}
                      disabled={pending}
                      onClick={() => setStatus(r.id, 'resolved')}
                      className="text-sm"
                    >
                      اتحلّ
                    </BusyButton>
                  ) : (
                    <BusyButton
                      variant="secondary"
                      busy={isBusy(r.id, 'pending')}
                      disabled={pending}
                      onClick={() => setStatus(r.id, 'pending')}
                      className="text-sm"
                    >
                      افتحه تاني
                    </BusyButton>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
