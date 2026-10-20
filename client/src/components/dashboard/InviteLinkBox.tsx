'use client';

import React, { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

/**
 * عرض رابط الدعوة للإدارة عشان تبعته بنفسها.
 *
 * ليه كده مش إيميل؟ لأن خدمة البريد مش مضبوطة على المشروع. الرابط بيحافظ
 * على نفس الخاصية الأمنية: الشخص هو اللي بيحدد كلمة مروره، ومفيش كلمة
 * مرور بتمر على الإدارة.
 */
export function InviteLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // نسخ فشل (متصفح قديم أو صلاحية مرفوضة) — الرابط ظاهر ويتحدد بالإيد.
      setCopied(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="mb-3 flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div className="text-sm text-emerald-900">
          <p className="font-bold">الحساب اتعمل. ابعت الرابط ده للشخص:</p>
          <p className="mt-1 font-medium">
            هيفتحه ويحدد كلمة مروره بنفسه. <strong>الرابط ده مفتاح حساب</strong> —
            أي حد يفتحه يقدر يحدد كلمة المرور، فابعته للشخص المقصود وحده، وهو
            صالح لمدة محدودة ولمرة واحدة.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          dir="ltr"
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left text-xs text-slate-700 outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'اتنسخ' : 'نسخ الرابط'}
        </button>
      </div>
    </div>
  );
}
