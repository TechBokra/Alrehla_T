'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, Unlock, Copy, Check, UserPlus } from 'lucide-react';
import type { ChildProfile } from '@/types';
import {
  createStudentAccount,
  resetStudentPassword,
  disableStudentAccount,
  enableStudentAccount,
} from '@/actions/student-accounts';

/**
 * حساب الدخول الخاص بفرد العائلة.
 *
 * ── ليه كلمة السر بتتعرض مرة واحدة ──────────────────────────
 *
 * تخزينها عشان ولي الأمر يشوفها بعدين معناها إننا بنحتفظ بكلمة سر
 * قابلة للقراءة في القاعدة — وده غلط مهما كانت المبررات. بتتعرض هنا
 * وقت الإنشاء أو إعادة التعيين وخلاص.
 *
 * ونسيها؟ مفيش «نسيت كلمة السر» للطفل — بريده داخلي ومايستقبلش
 * رسائل. الطريق الوحيد هو زر «كلمة سر جديدة» هنا.
 */
export function StudentAccountCell({
  child,
  enabled,
}: {
  child: ChildProfile;
  /** مفتاح الخدمة متظبط على الخادم؟ من غيره الأزرار بتتعطّل بدل ما تقع. */
  enabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{ loginId: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const hasAccount = Boolean(child.accountProfileId);

  const run = (fn: () => Promise<unknown>) => {
    setError('');
    startTransition(async () => {
      const result = (await fn()) as
        | { ok: true; loginId?: string; password?: string }
        | { ok: false; error: string };

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.loginId && result.password) {
        setCredentials({ loginId: result.loginId, password: result.password });
      }
      router.refresh();
    });
  };

  const copy = () => {
    if (!credentials) return;
    navigator.clipboard
      ?.writeText(`اسم الدخول: ${credentials.loginId}\nكلمة السر: ${credentials.password}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  if (credentials) {
    return (
      <div className="min-w-64 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-black text-emerald-800">
          اكتبهم دلوقتي — مش هيظهروا تاني
        </p>
        <div className="space-y-1 text-xs font-bold text-slate-700">
          <p dir="ltr" className="text-left">{credentials.loginId}</p>
          <p dir="ltr" className="text-left">{credentials.password}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-emerald-700"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'اتنسخ' : 'انسخ'}
          </button>
          <button
            type="button"
            onClick={() => setCredentials(null)}
            className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            تمام
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-48 space-y-1.5">
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      {!enabled && (
        <p className="text-xs font-medium text-slate-400">فتح الحسابات غير مفعّل حاليًا</p>
      )}

      {!hasAccount ? (
        <button
          type="button"
          disabled={!enabled || isPending}
          onClick={() => run(() => createStudentAccount(child.id))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-amber-400 disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {isPending ? 'جاري الفتح…' : 'افتح حساب دخول'}
        </button>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
            <KeyRound className="h-3 w-3" /> عنده حساب
          </span>
          <button
            type="button"
            disabled={!enabled || isPending}
            onClick={() => run(() => resetStudentPassword(child.id))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:border-amber-400 disabled:opacity-50"
          >
            كلمة سر جديدة
          </button>
          <button
            type="button"
            disabled={!enabled || isPending}
            onClick={() => run(() => disableStudentAccount(child.id))}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            <Lock className="h-3 w-3" /> إقفال
          </button>
          <button
            type="button"
            disabled={!enabled || isPending}
            onClick={() => run(() => enableStudentAccount(child.id))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:border-emerald-400 disabled:opacity-50"
          >
            <Unlock className="h-3 w-3" /> فتح
          </button>
        </div>
      )}
    </div>
  );
}
