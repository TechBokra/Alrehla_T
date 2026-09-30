'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { setMyPassword } from '@/actions/set-password';
import { FormError } from '@/components/ui/FormError';

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // ⚠️ التطابق بيتفحص هنا **وبس**: التانية مش بتتبعت للخادم أصلًا،
  //    فمفيش حاجة يتحقق منها هناك. والفحص الحقيقي (الطول) مكرر في
  //    الأكشن، لأن `required` في الواجهة مش دليل (قاعدة «ع»).
  const mismatch = confirm.length > 0 && password !== confirm;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('الكلمتين مش زي بعض.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await setMyPassword(password);
      if (!result.ok) {
        setError(result.error);
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
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-12 font-medium outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600"
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-xs font-medium text-slate-500">٨ حروف أو أرقام على الأقل.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="text-sm font-bold text-slate-700">
          اكتبها تاني
        </label>
        <div className="relative">
          <Lock className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`w-full rounded-xl border bg-slate-50 py-3 pr-12 pl-4 font-medium outline-none transition-all focus:ring-1 ${
              mismatch
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-200 focus:border-amber-500 focus:ring-amber-500'
            }`}
            placeholder="••••••••"
          />
        </div>
        {mismatch && (
          <p className="text-xs font-bold text-red-600">الكلمتين مش زي بعض.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={busy || password.length < 8 || password !== confirm}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'احفظ وادخل'}
        {!busy && <ArrowRight className="h-5 w-5 rotate-180" />}
      </button>
    </form>
  );
}
