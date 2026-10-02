'use client';

import React, { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

/**
 * الرمز المؤقت اللي الإدارة بتسلّمه لصاحب الحساب الجديد.
 *
 * ⚠️ **بيتعرض مرة واحدة وما بيتخزّنش عندنا.** Supabase بتخزّن بصمته
 *    المشفّرة بس، فلو الصفحة اتقفلت قبل النسخ، الرمز ضاع — والحل
 *    ساعتها إن الإدارة تعيد تعيينه، مش إنها «تشوفه تاني».
 *
 * ⚠️ **وما بيدّيش الإدارة كلمة المرور الدائمة.** أول ما صاحب الحساب
 *    يدخل بالرمز، الموقع بيوقفه على شاشة يحطّ فيها كلمة مروره، وبعدها
 *    الرمز مابقاش ينفع. يعني نفس ضمان رابط الدعوة القديم: **مفيش كلمة
 *    مرور دائمة بتعرفها الإدارة.**
 */
export function TempCodeBox({
  code,
  email,
  role = 'الشخص',
}: {
  code: string;
  email?: string;
  /** «المدرب» أو «الشخص» — بيغيّر نص الرسالة بس. */
  role?: string;
}) {
  const [copied, setCopied] = useState<'code' | 'all' | null>(null);

  const message = email
    ? `بياناتك على منصة الرحلة:\nالبريد: ${email}\nالرمز المؤقت: ${code}\n\nادخل بيه وهيطلب منك تحدد كلمة مرورك.`
    : code;

  const copy = async (what: 'code' | 'all') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : message);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      // النسخ فشل (متصفح قديم أو صلاحية مرفوضة) — الرمز ظاهر ويتكتب بالإيد.
      setCopied(null);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div className="text-sm text-emerald-900">
          <p className="font-bold">الحساب اتعمل. ابعت الرمز ده لـ{role}:</p>
          <p className="mt-1 font-medium">
            هيدخل بيه مرة واحدة، والموقع هيوقفه على شاشة يحطّ فيها كلمة مروره
            بنفسه. <strong>بعدها الرمز مايبقاش ينفع.</strong>
          </p>
          <p className="mt-1 font-medium">
            ⚠️ الرمز ده <strong>مش هيظهر تاني</strong> — انسخه دلوقتي.
          </p>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-center">
        <code dir="ltr" className="text-xl font-black tracking-widest text-slate-800">
          {code}
        </code>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => copy('code')}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-2 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied === 'code' ? 'اتنسخ' : 'نسخ الرمز'}
        </button>
        {email && (
          <button
            type="button"
            onClick={() => copy('all')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
          >
            {copied === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === 'all' ? 'اتنسخت' : 'نسخ الرسالة كاملة'}
          </button>
        )}
      </div>
    </div>
  );
}
