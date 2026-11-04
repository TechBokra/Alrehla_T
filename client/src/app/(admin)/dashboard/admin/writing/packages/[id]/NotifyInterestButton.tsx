'use client';

import { useState, useTransition } from 'react';
import { notifyPackageInterest } from '@/actions/package-interest';

/** «بلّغ المهتمين» — بعد فتح باقة كانت «قريبًا» (بند ٩). */
export function NotifyInterestButton({
  packageId,
  count,
}: {
  packageId: string;
  count: number;
}) {
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending || count === 0}
        onClick={() =>
          start(async () => {
            const r = await notifyPackageInterest(packageId);
            setMsg(
              r.ok
                ? `اتبعت إشعار لـ${r.sent.toLocaleString('ar-EG')} شخص.`
                : r.error
            );
          })
        }
        className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'بيتبعت…' : 'بلّغ المهتمين إن الباقة فتحت'}
      </button>
      {msg && (
        <p role="status" className="text-sm font-bold text-slate-700">
          {msg}
        </p>
      )}
    </div>
  );
}
