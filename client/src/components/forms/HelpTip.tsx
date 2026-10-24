'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * علامة «؟» صغيرة جنب عنوان الخانة — بتشرح المطلوب من غير ما تزحم الشاشة.
 *
 * الفرق عن `hint` (السطر تحت الخانة): الـ`hint` للحاجة اللي **لازم**
 * تتقري كل مرة (حد أقصى، تحذير). الـ«؟» للشرح اللي محتاجه أول مرة بس
 * («يعني إيه سعر يبدأ من؟»).
 *
 * ⚠️ **بتشتغل باللمس مش بالماوس بس:** على الموبايل مفيش «مرور»، فالضغطة
 *    بتفتحها وبتقفلها، وضغطة برّه أو `Esc` بتقفلها. وعلى الكمبيوتر بتظهر
 *    كمان لما الماوس يعدّي أو التركيز يوصلها بالكيبورد.
 * ⚠️ **`type="button"`:** جوّه نموذج، أي زرار من غير النوع ده بيبعت
 *    النموذج — ضغطة «؟» كانت هتحفظ.
 */
export function HelpTip({ text, label = 'شرح' }: { text: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = open || hover;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={shown}
        aria-describedby={shown ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-600 transition-colors hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ؟
      </button>
      {shown && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-7 right-0 z-30 w-64 max-w-[80vw] rounded-xl bg-slate-900 p-3 text-xs leading-relaxed font-medium text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
