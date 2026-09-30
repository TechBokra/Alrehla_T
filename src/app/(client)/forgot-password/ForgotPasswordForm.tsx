'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { requestPasswordReset } from '@/actions/auth';
import { FormError } from '@/components/ui/FormError';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await requestPasswordReset(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(result.notice ?? '');
    } catch {
      setError('حصلت مشكلة ومكملناش. جرّب تاني.');
    } finally {
      setBusy(false);
    }
  };

  // ⚠️ **نفس الشاشة في كل الحالات**، سواء البريد مسجَّل عندنا ولا لأ.
  //    لو الشاشة فرّقت، أي حد كان يقدر يكتب بريد ويعرف منّنا هل صاحبه
  //    عميل عندنا — ودي معلومة عن عملائنا مش عنّا.
  if (notice) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="leading-relaxed font-medium text-slate-600">{notice}</p>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800"
        >
          رجوع لتسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <FormError message={error} />

      <div className="space-y-2">
        <label htmlFor="reset-email" className="text-sm font-bold text-slate-700">
          البريد الإلكتروني
        </label>
        <div className="relative">
          <Mail className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="reset-email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-4 text-right font-medium outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="name@example.com"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || email.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'ابعتلي الرابط'}
        {!busy && <ArrowRight className="h-5 w-5 rotate-180" />}
      </button>

      <p className="text-center text-sm font-medium text-slate-500">
        فاكرها؟{' '}
        <Link href="/sign-in" className="font-bold text-amber-600 hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}
