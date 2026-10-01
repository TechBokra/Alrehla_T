'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DueBoxShipment } from '@/data/domains/subscriptions';
import { updateBoxShipment } from '@/actions/box-subscriptions';
import { FormError } from '@/components/ui/FormError';
import { formatDate } from '@/lib/utils';

/** صناديق الشهر — كل صندوق بزراره (نفس `updateBoxShipment`). */
export function DueShipmentsClient({ rows }: { rows: DueBoxShipment[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState<Record<string, string>>({});

  const run = (id: string, status: 'preparing' | 'shipped') =>
    start(async () => {
      setError('');
      const r = await updateBoxShipment({ shipmentId: id, status, trackingReference: tracking[id] });
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  return (
    <div className="space-y-3">
      <FormError message={error} />
      {rows.map((r) => (
        <div
          key={r.shipment.id}
          className={`rounded-2xl border bg-white p-4 ${r.overdue ? 'border-red-300' : 'border-slate-200'}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-sm">
              <p className="text-base font-black text-slate-900">
                {r.childName ?? 'طفل'} — الشهر {r.shipment.monthNumber} من {r.months}
              </p>
              <p className="text-slate-700">
                {r.planName} · موعده {formatDate(r.dueDate)}
                {r.overdue && <span className="font-bold text-red-700"> · متأخر</span>}
              </p>
              <p className="text-slate-800">
                الهدف: {r.shipment.goal ?? <span className="font-bold text-amber-800">تختاره الإدارة</span>}
              </p>
              {r.freeAddonName && <p className="text-emerald-800">+ {r.freeAddonName} (مجانًا)</p>}
              {r.recipient && (
                <p className="text-slate-700">
                  {r.recipient.name} · <span dir="ltr">{r.recipient.phone}</span> · {r.recipient.address}
                </p>
              )}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                r.shipment.status === 'preparing' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {r.shipment.status === 'preparing' ? 'بيتجهّز' : 'لسه'}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {r.shipment.status === 'pending' && (
              <button type="button" disabled={pending} onClick={() => run(r.shipment.id, 'preparing')}
                className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50">
                بدأ التجهيز
              </button>
            )}
            <input
              aria-label="رقم الشحنة"
              placeholder="رقم الشحنة (اختياري)"
              dir="ltr"
              value={tracking[r.shipment.id] ?? ''}
              onChange={(e) => setTracking((t) => ({ ...t, [r.shipment.id]: e.target.value }))}
              className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <button type="button" disabled={pending} onClick={() => run(r.shipment.id, 'shipped')}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
              اتشحن
            </button>
            <Link href={`/dashboard/admin/subscriptions/box/${r.subscriptionId}`}
              className="text-xs font-bold text-blue-700 hover:underline">
              بيانات الطفل وصوره ←
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
