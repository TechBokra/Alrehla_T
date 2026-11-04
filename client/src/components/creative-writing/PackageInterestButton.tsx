'use client';

import { useState, useTransition } from 'react';
import { Bell, Check } from 'lucide-react';
import { registerPackageInterest } from '@/actions/package-interest';

/**
 * «قريبًا» + «بلّغني لما تفتح» — مكان زرار الحجز في الباقة المقفولة
 * (قرار ٢٤ أكتوبر، بند ٩: الباقة ظاهرة والحجز مقفول وقت الإطلاق).
 */
export function PackageInterestButton({
  packageId,
  className = '',
}: {
  packageId: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const register = () =>
    startTransition(async () => {
      const res = await registerPackageInterest(packageId);
      if (res.ok) {
        setState('done');
        setMessage(
          res.already
            ? 'مسجّل قبل كده — هنبلّغك أول ما تفتح.'
            : 'تمام — هنبلّغك أول ما تفتح.'
        );
      } else {
        setState('error');
        setMessage(res.error);
      }
    });

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-900">
        قريبًا — الحجز لسه مافتحش
      </span>
      {state === 'done' ? (
        <p
          role="status"
          className="inline-flex items-center justify-center gap-1 text-sm font-bold text-emerald-700"
        >
          <Check className="h-4 w-4" />
          {message}
        </p>
      ) : (
        <button
          type="button"
          onClick={register}
          disabled={pending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none disabled:opacity-60"
        >
          <Bell className="h-4 w-4" />
          {pending ? 'لحظة…' : 'بلّغني لما تفتح'}
        </button>
      )}
      {state === 'error' && (
        <p role="alert" className="text-center text-sm font-bold text-rose-700">
          {message}
        </p>
      )}
    </div>
  );
}
