'use client';

import React, { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { transferProviderWork } from '@/actions/providers';
import { FormError } from '@/components/ui/FormError';
import { BusyButton, Select } from '@/components/forms/Form';

/**
 * نقل طلبات مقدّم خدمة لمقدّم تاني.
 *
 * ⚠️ **بنفس السعر.** العميل اتفق على رقم، وسعر المقدّم الجديد ممكن
 *    يكون أعلى أو أقل — ومش ذنبه في الحالتين. الفرق على المنصة.
 *
 * ⚠️ **وبيعرض اللي اترفض بسببه.** طلب اتسجّل له مستحق، أو المقدّم
 *    الجديد مابيقدّمش الخدمة دي — الاتنين بيرجعوا بأرقامهم بدل ما
 *    يتساكت عنهم.
 */
export function TransferProviderPanel({
  providerId,
  providerName,
  targets,
}: {
  providerId: string;
  providerName: string;
  targets: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | {
    toName: string;
    moved: number;
    blocked: { id: string; status: string; why: string }[];
    remaining: number;
  }>(null);

  const run = async () => {
    if (busy || !to) return;
    setBusy(true);
    setError('');
    setDone(null);
    try {
      const r = await transferProviderWork(providerId, to);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(r);
      setTo('');
    } catch {
      setError('تعذّر نقل الطلبات — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  if (targets.length === 0) {
    return (
      <p className="text-xs font-medium text-slate-500">
        مفيش مقدّم «مفعّل» تاني تنقل له الطلبات.
      </p>
    );
  }

  return (
    <div>
      {!open && !done && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          انقل طلباته لمقدّم تاني
        </button>
      )}

      {open && !done && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-1 text-xs font-black text-slate-800">نقل طلبات {providerName}</p>
          <p className="mb-3 text-[11px] font-medium text-slate-500">
            بتنتقل الطلبات الجارية <strong>بنفس السعر والمستحق</strong>. اللي
            اتسجّل له مستحق، واللي المقدّم الجديد مابيقدّمش خدمته، مابيتنقلوش.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto min-w-48"
              aria-label="المقدّم اللي هتنتقل له الطلبات"
            >
              <option value="">اختار المقدّم…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>

            <BusyButton busy={busy} pendingLabel="بينقل…" onClick={run} disabled={!to}>
              انقل الطلبات
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
          <p className="font-black text-emerald-900">
            اتنقل {done.moved} طلب لـ{done.toName}
          </p>

          {/* بيتقرا من القاعدة **بعد** النقل — «اتنقل» من غير تأكيد هو
              بالظبط النجاح الكاذب اللي بنقفله في كل حتة. */}
          {done.remaining > 0 && (
            <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 font-bold text-rose-800">
              لسه فيه {done.remaining} طلب على {providerName} — شوف الأسباب تحت.
            </p>
          )}

          {done.blocked.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-2 font-medium text-amber-900">
              {done.blocked.map((b) => (
                <li key={b.id}>
                  <span className="font-mono" dir="ltr">
                    {b.id}
                  </span>{' '}
                  — {b.why}
                </li>
              ))}
            </ul>
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
