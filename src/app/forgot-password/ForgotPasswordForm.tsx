'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { requestPasswordReset } from '@/actions/auth';
import { FormError } from '@/components/ui/FormError';
import { Button } from '@/components/ui/Button';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [remaining, setRemaining] = useState(0);
  const coolingDown = remaining > 0;

  // UX cooldown only; Supabase enforces the actual server-side rate limits.
  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  const sendReset = async () => {
    if (busy || coolingDown) return;
    setBusy(true);
    setError('');
    try {
      const result = await requestPasswordReset(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(result.notice ?? '');
      setRemaining(60);
    } catch {
      setError('حصلت مشكلة ومكملناش. جرّب تاني.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendReset();
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
        <p role="status" className="leading-relaxed font-medium text-slate-600">{notice}</p>
        <FormError message={error} />
        <Button type="button" variant="secondary" pending={busy} pendingText="جارٍ إرسال الرابط…" disabled={coolingDown} onClick={() => { void sendReset(); }}>
          {coolingDown ? `إعادة الإرسال بعد ${remaining} ثانية` : 'إعادة إرسال الرابط'}
        </Button>
        <div className="flex flex-col items-center gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => { setNotice(''); setError(''); }}>تغيير البريد الإلكتروني</Button>
          <Button href="/sign-in" variant="neutral">رجوع لتسجيل الدخول</Button>
        </div>
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
            name="email"
            disabled={busy}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? 'reset-email-error' : undefined}
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-4 text-right font-medium outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="name@example.com"
          />
        </div>
        {error && <p id="reset-email-error" className="text-sm text-red-600">{error}</p>}
      </div>

      <Button
        type="submit"
        variant="neutral"
        pending={busy}
        pendingText="جارٍ إرسال الرابط…"
        disabled={coolingDown || email.trim().length === 0}
        className="w-full gap-2"
      >
        {coolingDown ? `إرسال رابط بعد ${remaining} ثانية` : 'ابعتلي الرابط'}
        {!busy && <ArrowRight className="h-5 w-5 rotate-180" />}
      </Button>

      <p className="text-center text-sm font-medium text-slate-500">
        فاكرها؟{' '}
        <Link href="/sign-in" className="font-bold text-amber-600 hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}
