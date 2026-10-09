'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { setMyPassword } from '@/actions/set-password';
import { resetRecoveredPassword } from '@/actions/reset-password';
import { FormError } from '@/components/ui/FormError';
import { Button } from '@/components/ui/Button';

export function SetPasswordForm({ recovery = false }: { recovery?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  // Recovery validates both values again on the server.
  const mismatch = confirm.length > 0 && password !== confirm;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError('الكلمتين مش زي بعض.');
      return;
    }
    setBusy(true);
    setError('');
    setFieldError(null);
    try {
      const result = recovery
        ? await resetRecoveredPassword(password, confirm)
        : await setMyPassword(password);
      if (!result.ok) {
        if (result.field) setFieldError({ field: result.field, message: result.error });
        else setError(result.error);
        return;
      }
      // الحاجز اتشال — `/dashboard` بتوزّع كل دور على لوحته.
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('حصلت مشكلة ومكملناش. جرّب تاني.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={submit}>
      <FormError message={error} />

      <div className="space-y-2">
        <label htmlFor="new-password" className="text-sm font-bold text-slate-700">
          كلمة المرور الجديدة
        </label>
        <div className="relative">
          <Lock className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="new-password"
            name="newPassword"
            disabled={busy}
            aria-invalid={fieldError?.field === 'newPassword' || undefined}
            aria-describedby={fieldError?.field === 'newPassword' ? 'password-help password-error' : 'password-help'}
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldError(null); }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-12 font-medium outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            aria-pressed={show}
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600"
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <p id="password-help" className="text-xs font-medium text-slate-500">٨ حروف أو أرقام على الأقل.</p>
        {fieldError?.field === 'newPassword' && <p id="password-error" role="alert" className="text-sm text-red-600">{fieldError.message}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="text-sm font-bold text-slate-700">
          اكتبها تاني
        </label>
        <div className="relative">
          <Lock className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="confirm-password"
            name="confirmPassword"
            disabled={busy}
            aria-invalid={mismatch || fieldError?.field === 'confirmPassword' || undefined}
            aria-describedby={mismatch || fieldError?.field === 'confirmPassword' ? 'confirm-error' : undefined}
            type={show ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setFieldError(null); }}
            className={`w-full rounded-xl border bg-slate-50 py-3 pr-12 pl-4 font-medium outline-none transition-all focus:ring-1 ${
              mismatch
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-200 focus:border-amber-500 focus:ring-amber-500'
            }`}
            placeholder="••••••••"
          />
        </div>
        {(mismatch || fieldError?.field === 'confirmPassword') && (
          <p id="confirm-error" role="alert" className="text-xs font-bold text-red-600">{fieldError?.field === 'confirmPassword' ? fieldError.message : 'الكلمتين مش زي بعض.'}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="neutral"
        pending={busy}
        pendingText="جارٍ حفظ كلمة المرور…"
        disabled={busy || password.length < 8 || password !== confirm}
        className="w-full gap-2"
      >
        {recovery ? 'احفظ كلمة المرور' : 'احفظ وادخل'}
        {!busy && <ArrowRight className="h-5 w-5 rotate-180" />}
      </Button>
    </form>
  );
}
