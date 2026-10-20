'use client';

import React, { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { transferInstructorWork } from '@/actions/instructors';
import { FormError } from '@/components/ui/FormError';
import { BusyButton, Select } from '@/components/forms/Form';

/**
 * نقل شغل مدرب لمدرب تاني.
 *
 * ⚠️ **مكانها جنب أزرار الحالة عن قصد.** الإدارة بتوقف مدربًا وتقفل
 *    الصفحة — والجلسات المحجوزة تفضل مسنودة له: العميل دافع، وميعاده
 *    قايم، ومحدّش هيحضره. فالنقل لازم يكون في نفس المكان واللحظة.
 *
 * ⚠️ **وبتقول اللي مانتقلش، مش بتسكت عنه.** طلب خدمة اتسجّل له مستحق
 *    مابيتنقلش (الفلوس عند واحد والشغل عند التاني)، وجلسة مكتملة
 *    مابتتحركش. اللي بيترفض بيتعرض بالرقم.
 */
export function TransferWorkPanel({
  instructorId,
  instructorName,
  targets,
}: {
  instructorId: string;
  instructorName: string;
  targets: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | {
    toName: string;
    sessions: number;
    tasks: number;
    serviceOrders: number;
    blockedOrders: { id: string; status: string }[];
    sessionsRemaining: number;
  }>(null);

  const run = async () => {
    if (busy || !to) return;
    setBusy(true);
    setError('');
    setDone(null);
    try {
      const r = await transferInstructorWork(instructorId, to);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(r);
      setTo('');
    } catch {
      setError('تعذّر نقل الشغل — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  if (targets.length === 0) {
    return (
      <p className="w-full pt-1 text-[11px] font-medium text-slate-500">
        مفيش مدرب «نشط» تاني ينتقل له الشغل.
      </p>
    );
  }

  return (
    <div className="w-full pt-2">
      {!open && !done && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          انقل شغله لمدرب تاني
        </button>
      )}

      {open && !done && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-1 text-xs font-black text-slate-800">
            نقل شغل {instructorName}
          </p>
          <p className="mb-3 text-[11px] font-medium text-slate-500">
            بينتقل: الجلسات الجاية، والمهام المفتوحة، وطلبات الخدمة اللي لسه
            مالهاش مستحق. الجلسات المكتملة ومستحقاته مابتتحركش.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto min-w-48"
              aria-label="المدرب اللي هينتقل له الشغل"
            >
              <option value="">اختار المدرب…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>

            <BusyButton busy={busy} pendingLabel="بينقل…" onClick={run} disabled={!to}>
              انقل الشغل
            </BusyButton>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError('');
              }}
              className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              تراجع
            </button>
          </div>

          <FormError message={error} className="mt-3" />
        </div>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs">
          <p className="font-black text-emerald-900">اتنقل لـ{done.toName}</p>
          <p className="mt-1 font-medium text-emerald-800">
            {done.sessions} جلسة · {done.tasks} مهمة · {done.serviceOrders} طلب خدمة
          </p>

          {/* ⚠️ العدد ده بيتقرا من القاعدة **بعد** النقل. أكبر من صفر
              معناه إن فيه جلسات مانتقلتش، والإدارة لازم تعرف دلوقتي. */}
          {done.sessionsRemaining > 0 && (
            <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 font-bold text-rose-800">
              لسه فيه {done.sessionsRemaining} جلسة ما اتنقلتش — راجعها بنفسك.
            </p>
          )}

          {done.blockedOrders.length > 0 && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 font-medium text-amber-900">
              <p className="font-bold">
                {done.blockedOrders.length} طلب خدمة ما اتنقلش — اتسجّل له مستحق
                بالفعل، ونقله كان هيخلّي الفلوس عند واحد والشغل عند التاني:
              </p>
              <p className="mt-1 font-mono" dir="ltr">
                {done.blockedOrders.map((o) => o.id).join('، ')}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setDone(null);
              setOpen(false);
            }}
            className="mt-3 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 font-bold text-emerald-800"
          >
            تمام
          </button>
        </div>
      )}
    </div>
  );
}
