'use client'

import Link from 'next/link'
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { signIn } from '@/actions/auth'
import { isControlFlowError } from '@/lib/use-action'
import { FormError } from '@/components/ui/FormError'

export function SignInForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    // المكان اللي الحارس وقفه عنه، من الرابط.
    //
    // ⚠️ بنقراه من `window.location` مش من `useSearchParams` عن قصد:
    //    الخطاف ده بيخلّي الصفحة تتطلب حدود `Suspense` وقت البناء،
    //    وصفحة الدخول دي ثابتة. والقيمة بتتفحص على الخادم برضه.
    const next = new URLSearchParams(window.location.search).get('next')
    if (next) formData.set('next', next)

    try {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
      }
    } catch (err) {
      // ⚠️ **الدخول الناجح بيرمي.** `redirect()` في Next بيشتغل برمي
      //    استثناء، وأي `catch` شامل بيبلعه — فالمستخدم كان ممكن يدخل
      //    صح ويشوف «حدث خطأ غير متوقع» والانتقال يتمنع. الاستثناء ده
      //    بيتعاد رميه عشان Next يكمّل التحويل.
      if (isControlFlowError(err)) throw err
      setError('حصلت مشكلة ومكملناش. جرّب تاني، ولو فضلت كلّمنا.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <FormError message={error} />
      <div className="space-y-2">
        <label htmlFor="signin-email" className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
        <div className="relative">
          <Mail className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="signin-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-4 text-right font-medium transition-all outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="example@email.com"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="signin-password" className="text-sm font-bold text-slate-700">كلمة المرور</label>
        <div className="relative">
          <Lock className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="signin-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-12 font-medium transition-all outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="••••••••"
          />
          {/* المستخدم مش شايف اللي بيكتبه، ولوحة المفاتيح العربية سبب
              متكرر لكلمة سر غلط من غير ما يعرف. */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تسجيل الدخول'}
        {!pending && <ArrowRight className="h-5 w-5 rotate-180" />}
      </button>

      {/* ⚠️ **الرابط ده مكانش موجود، ولا الصفحة اللي وراه.** واللي
          بينسى كلمة مروره بيبقى واقف على الشاشة دي بالظبط — فده
          مكانه الطبيعي. */}
      <p className="text-center">
        <Link
          href="/forgot-password"
          className="text-sm font-bold text-slate-500 transition-colors hover:text-amber-600 hover:underline"
        >
          نسيت كلمة المرور؟
        </Link>
      </p>
    </form>
  )
}
