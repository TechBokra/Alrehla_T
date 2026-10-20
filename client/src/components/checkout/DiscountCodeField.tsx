'use client';

import React, { useId, useState } from 'react';
import { Loader2, Ticket, X } from 'lucide-react';
import { checkDiscountCode } from '@/actions/discount-codes';
import type { DiscountLine } from '@/lib/discount-codes';

export type AppliedDiscount = { code: string; percent: number };

/**
 * خانة «كود خصم» في صفحات الدفع (ملف 13).
 *
 * بتسأل الخادم «الكود ده ينفع؟» وبتوري النسبة. ⚠️ **ده عرض بس**: الخصم
 * بيتحسب تاني في القاعدة وقت تسجيل الطلب — ولو الكود خلص في النص،
 * الطلب بيترفض برسالة واضحة والعميل يشيله ويكمّل.
 */
export function DiscountCodeField({
  line,
  value,
  onChange,
  disabled,
}: {
  line: DiscountLine;
  value: AppliedDiscount | null;
  onChange: (v: AppliedDiscount | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = async () => {
    if (!text.trim()) {
      setError('اكتب الكود الأول');
      return;
    }
    setBusy(true);
    setError('');
    const r = await checkDiscountCode(text, line);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onChange({ code: r.code, percent: r.percent });
    setText('');
  };

  if (value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-emerald-900">
          <Ticket className="h-4 w-4" aria-hidden="true" />
          كود <span dir="ltr" className="font-mono">{value.code}</span> — خصم {value.percent.toLocaleString('ar-EG')}٪
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" /> شيله
        </button>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">
        عندك كود خصم؟
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          dir="ltr"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value.toUpperCase());
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
          disabled={disabled || busy}
          maxLength={30}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`min-w-0 flex-1 rounded-xl border bg-white px-4 py-2.5 font-mono text-slate-800 outline-none focus:border-slate-500 ${error ? 'border-red-400' : 'border-slate-200'}`}
        />
        <button
          type="button"
          onClick={apply}
          disabled={disabled || busy}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:border-slate-500 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          تطبيق
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
