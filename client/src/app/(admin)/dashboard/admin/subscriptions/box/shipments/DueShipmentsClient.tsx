'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DueBoxShipment } from '@/data/domains/(shared)/subscriptions/types';
import { updateBoxShipment } from '@/actions/box-subscriptions';
import { FormError } from '@/components/ui/FormError';
import { formatDate } from '@/lib/utils';
import { TextInput, BusyButton } from '@/components/forms/Form';

/** صناديق الشهر — كل صندوق بزراره (نفس `updateBoxShipment`). */
export function DueShipmentsClient({ rows }: { rows: DueBoxShipment[] }) {
  const router = useRouter();
  // الزرار اللي شغّال (`شحنة:حالة`) — هو بس اللي بيكتب «جارٍ…»، والباقي بيتقفل.
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // الخطأ بيظهر تحت الصندوق اللي فشل، مش فوق القايمة كلها.
  const [failure, setFailure] = useState<{ id: string; error: string } | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});

  const run = async (id: string, status: 'preparing' | 'shipped') => {
    if (busyKey) return;
    setFailure(null);
    setBusyKey(`${id}:${status}`);
    try {
      const r = await updateBoxShipment({ shipmentId: id, status, trackingReference: tracking[id] });
      if (!r.ok) setFailure({ id, error: r.error });
      else router.refresh();
    } catch {
      setFailure({ id, error: 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.' });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-3">
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
              <BusyButton
                variant="secondary"
                busy={busyKey === `${r.shipment.id}:preparing`}
                pendingLabel="جارٍ التحديث…"
                disabled={busyKey !== null}
                onClick={() => run(r.shipment.id, 'preparing')}
              >
                بدأ التجهيز
              </BusyButton>
            )}
            <div className="w-44">
              <TextInput
                aria-label="رقم الشحنة"
                placeholder="رقم الشحنة (اختياري)"
                dir="ltr"
                value={tracking[r.shipment.id] ?? ''}
                onChange={(e) => setTracking((t) => ({ ...t, [r.shipment.id]: e.target.value }))}
              />
            </div>
            <BusyButton
              busy={busyKey === `${r.shipment.id}:shipped`}
              pendingLabel="جارٍ التحديث…"
              disabled={busyKey !== null}
              onClick={() => run(r.shipment.id, 'shipped')}
            >
              اتشحن
            </BusyButton>
            <Link href={`/dashboard/admin/subscriptions/box/${r.subscriptionId}`}
              className="text-xs font-bold text-blue-700 hover:underline">
              بيانات الطفل وصوره ←
            </Link>
          </div>
          <FormError message={failure?.id === r.shipment.id ? failure.error : ''} className="mt-3" />
        </div>
      ))}
    </div>
  );
}
