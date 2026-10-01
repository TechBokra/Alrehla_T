'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BoxShipment } from '@/types';
import { updateBoxShipment, setBoxSubscriptionStatus } from '@/actions/box-subscriptions';
import { FormError } from '@/components/ui/FormError';
import { formatDate } from '@/lib/utils';

const LABEL: Record<BoxShipment['status'], string> = {
  pending: 'لسه',
  preparing: 'بيتجهّز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
};
const TONE: Record<BoxShipment['status'], string> = {
  pending: 'bg-slate-100 text-slate-800',
  preparing: 'bg-amber-100 text-amber-900',
  shipped: 'bg-blue-100 text-blue-900',
  delivered: 'bg-emerald-100 text-emerald-900',
};

/** شحنات الشهور — كل شهر بزراره (ملف 140). */
export function ShipmentsClient({
  shipments,
  freeAddonName,
}: {
  shipments: BoxShipment[];
  freeAddonName?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState<Record<string, string>>({});

  const run = (id: string, status: 'preparing' | 'shipped' | 'delivered') =>
    start(async () => {
      setError('');
      const r = await updateBoxShipment({ shipmentId: id, status, trackingReference: tracking[id] });
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  return (
    <div className="space-y-3">
      <FormError message={error} />
      {freeAddonName && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
          مع كل صندوق: {freeAddonName} (مجانًا)
        </p>
      )}
      {shipments.map((s) => (
        <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black text-slate-900">الشهر {s.monthNumber.toLocaleString('ar-EG')}</p>
              <p className="text-sm text-slate-700">
                الهدف: {s.goal ?? <span className="font-bold text-amber-800">تختاره الإدارة</span>}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE[s.status]}`}>
              {LABEL[s.status]}
              {s.shippedAt && s.status !== 'pending' && ` · ${formatDate(s.shippedAt)}`}
            </span>
          </div>
          {s.trackingReference && (
            <p className="mt-2 text-sm font-bold text-blue-800" dir="ltr">{s.trackingReference}</p>
          )}
          {s.status !== 'delivered' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {s.status === 'pending' && (
                <button type="button" disabled={pending} onClick={() => run(s.id, 'preparing')}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50">
                  بدأ التجهيز
                </button>
              )}
              {(s.status === 'pending' || s.status === 'preparing') && (
                <>
                  <input
                    aria-label={`رقم شحنة الشهر ${s.monthNumber}`}
                    placeholder="رقم الشحنة (اختياري)"
                    dir="ltr"
                    value={tracking[s.id] ?? ''}
                    onChange={(e) => setTracking((t) => ({ ...t, [s.id]: e.target.value }))}
                    className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button type="button" disabled={pending} onClick={() => run(s.id, 'shipped')}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                    اتشحن
                  </button>
                </>
              )}
              {s.status === 'shipped' && (
                <button type="button" disabled={pending} onClick={() => run(s.id, 'delivered')}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                  اتسلّم
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SubscriptionStatusControls({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: 'active' | 'paused' | 'cancelled';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const run = (next: 'active' | 'paused' | 'cancelled') =>
    start(async () => {
      setError('');
      const r = await setBoxSubscriptionStatus(subscriptionId, next);
      if (!r.ok) setError(r.error);
      else {
        setConfirmCancel(false);
        router.refresh();
      }
    });

  if (status === 'cancelled') {
    return <p className="text-sm font-bold text-slate-700">الاشتراك ملغي.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormError message={error} />
      {status === 'active' ? (
        <button type="button" disabled={pending} onClick={() => run('paused')}
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50">
          إيقاف مؤقت
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => run('active')}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">
          تشغيل
        </button>
      )}
      {confirmCancel ? (
        <>
          <span className="text-xs font-bold text-red-800">إلغاء نهائي؟ خصم المشترك بيقف فورًا.</span>
          <button type="button" disabled={pending} onClick={() => run('cancelled')}
            className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">أيوه، إلغاء</button>
          <button type="button" onClick={() => setConfirmCancel(false)}
            className="rounded-lg px-3 py-2 text-xs font-bold text-slate-700">لأ</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmCancel(true)}
          className="rounded-lg px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-50">
          إلغاء الاشتراك
        </button>
      )}
    </div>
  );
}
