'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BoxShipment } from '@/types';
import { updateBoxShipment, setBoxSubscriptionStatus, setBoxShipmentGoal } from '@/actions/box-subscriptions';
import { FormError } from '@/components/ui/FormError';
import { formatDate } from '@/lib/utils';
import { TextInput, BusyButton, Select } from '@/components/forms/Form';

const UNEXPECTED = 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.';

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
  goals = [],
}: {
  shipments: BoxShipment[];
  freeAddonName?: string;
  /** أهداف التخصيص الخاصة بالصندوق (منتجات المنصة ← أهداف التخصيص). */
  goals?: string[];
}) {
  const router = useRouter();
  // الزرار اللي شغّال (`شحنة:حالة`) — هو بس اللي بيكتب «جارٍ…»، والباقي بيتقفل.
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // الخطأ بيظهر تحت الشهر اللي فشل.
  const [failure, setFailure] = useState<{ id: string; error: string } | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});

  const saveGoal = async (id: string, goal: string) => {
    if (busyKey) return;
    setFailure(null);
    setBusyKey(`${id}:goal`);
    try {
      const r = await setBoxShipmentGoal({ shipmentId: id, goal });
      if (!r.ok) setFailure({ id, error: r.error });
      else router.refresh();
    } catch {
      setFailure({ id, error: UNEXPECTED });
    } finally {
      setBusyKey(null);
    }
  };

  const run = async (id: string, status: 'preparing' | 'shipped' | 'delivered') => {
    if (busyKey) return;
    setFailure(null);
    setBusyKey(`${id}:${status}`);
    try {
      const r = await updateBoxShipment({ shipmentId: id, status, trackingReference: tracking[id] });
      if (!r.ok) setFailure({ id, error: r.error });
      else router.refresh();
    } catch {
      setFailure({ id, error: UNEXPECTED });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-3">
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
              {/* ⭐ (#9OSP) الإدارة بتختار هدف الشهر لحد ما يتشحن. */}
              {s.status === 'pending' || s.status === 'preparing' ? (
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                  <span>الهدف:</span>
                  <div className="w-60">
                    <Select
                      aria-label={`هدف قصة الشهر ${s.monthNumber}`}
                      value={s.goal ?? ''}
                      disabled={busyKey !== null}
                      onChange={(e) => saveGoal(s.id, e.target.value)}
                    >
                      <option value="">تختاره الإدارة (لسه)</option>
                      {[...new Set([...(s.goal ? [s.goal] : []), ...goals])].map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {busyKey === `${s.id}:goal` && <span className="text-xs text-slate-500">بيتحفظ…</span>}
                </div>
              ) : (
                <p className="text-sm text-slate-700">
                  الهدف: {s.goal ?? <span className="font-bold text-amber-800">ماتحددش</span>}
                </p>
              )}
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
                <BusyButton
                  variant="secondary"
                  busy={busyKey === `${s.id}:preparing`}
                  pendingLabel="جارٍ التحديث…"
                  disabled={busyKey !== null}
                  onClick={() => run(s.id, 'preparing')}
                >
                  بدأ التجهيز
                </BusyButton>
              )}
              {(s.status === 'pending' || s.status === 'preparing') && (
                <>
                  <div className="w-44">
                    <TextInput
                      aria-label={`رقم شحنة الشهر ${s.monthNumber}`}
                      placeholder="رقم الشحنة (اختياري)"
                      dir="ltr"
                      value={tracking[s.id] ?? ''}
                      onChange={(e) => setTracking((t) => ({ ...t, [s.id]: e.target.value }))}
                    />
                  </div>
                  <BusyButton
                    busy={busyKey === `${s.id}:shipped`}
                    pendingLabel="جارٍ التحديث…"
                    disabled={busyKey !== null}
                    onClick={() => run(s.id, 'shipped')}
                  >
                    اتشحن
                  </BusyButton>
                </>
              )}
              {s.status === 'shipped' && (
                <BusyButton
                  busy={busyKey === `${s.id}:delivered`}
                  pendingLabel="جارٍ التحديث…"
                  disabled={busyKey !== null}
                  onClick={() => run(s.id, 'delivered')}
                >
                  اتسلّم
                </BusyButton>
              )}
            </div>
          )}
          <FormError message={failure?.id === s.id ? failure.error : ''} className="mt-3" />
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
  // الحالة اللي بتتبعت دلوقتي — زرارها بس اللي بيكتب «جارٍ…».
  const [busyNext, setBusyNext] = useState<'active' | 'paused' | 'cancelled' | null>(null);
  const pending = busyNext !== null;
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const run = async (next: 'active' | 'paused' | 'cancelled') => {
    if (pending) return;
    setError('');
    setBusyNext(next);
    try {
      const r = await setBoxSubscriptionStatus(subscriptionId, next);
      if (!r.ok) setError(r.error);
      else {
        setConfirmCancel(false);
        router.refresh();
      }
    } catch {
      setError(UNEXPECTED);
    } finally {
      setBusyNext(null);
    }
  };

  if (status === 'cancelled') {
    return <p className="text-sm font-bold text-slate-700">الاشتراك ملغي.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormError message={error} />
      {status === 'active' ? (
        <BusyButton
          variant="secondary"
          busy={busyNext === 'paused'}
          pendingLabel="جارٍ الإيقاف…"
          disabled={pending}
          onClick={() => run('paused')}
        >
          إيقاف مؤقت
        </BusyButton>
      ) : (
        <BusyButton
          busy={busyNext === 'active'}
          pendingLabel="جارٍ التشغيل…"
          disabled={pending}
          onClick={() => run('active')}
        >
          تشغيل
        </BusyButton>
      )}
      {confirmCancel ? (
        <>
          <span className="text-xs font-bold text-red-800">إلغاء نهائي؟ خصم المشترك بيقف فورًا.</span>
          <BusyButton
            variant="danger"
            busy={busyNext === 'cancelled'}
            pendingLabel="جارٍ الإلغاء…"
            disabled={pending}
            onClick={() => run('cancelled')}
          >
            أيوه، إلغاء
          </BusyButton>
          <button type="button" disabled={pending} onClick={() => setConfirmCancel(false)}
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
