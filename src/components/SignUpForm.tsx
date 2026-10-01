'use client'

import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { signUp } from '@/actions/auth'
import { isControlFlowError } from '@/lib/use-action'
import { FormError, FormNotice } from '@/components/ui/FormError'

export function SignUpForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    setNotice(null)

    const formData = new FormData(e.currentTarget)
    // نفس `SignInForm`: الصفحة اللي العميل جاي منها (المعالج / الدفع).
    const next = new URLSearchParams(window.location.search).get('next')
    if (next) formData.set('next', next)
    try {
      const result = await signUp(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.notice) {
        // الحساب اتعمل بس مفيش جلسة — تأكيد البريد مفتوح.
        setNotice(result.notice)
      }
    } catch (err) {
      // ⚠️ التسجيل الناجح بيرمي (`redirect`) — الاستثناء ده بيتعاد رميه
      //    عشان الانتقال يتم، مش يتبلع ويتحوّل لرسالة خطأ كاذبة.
      if (isControlFlowError(err)) throw err
      setError('حصلت مشكلة ومكملناش. جرّب تاني، ولو فضلت كلّمنا.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <FormError message={error} />
      <FormNotice message={notice} />
      <div className="space-y-2">
        <label htmlFor="signup-name" className="text-sm font-bold text-slate-700">الاسم الكامل</label>
        <div className="relative">
          <User className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="signup-name"
            name="fullName"
            type="text"
            required
            autoComplete="name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-4 font-medium transition-all outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="الاسم"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="signup-email" className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
        <div className="relative">
          <Mail className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="signup-email"
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
        <label htmlFor="signup-password" className="text-sm font-bold text-slate-700">كلمة المرور</label>
        <div className="relative">
          <Lock className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="signup-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-12 font-medium transition-all outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-xs font-medium text-slate-500">٦ حروف أو أرقام على الأقل.</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إنشاء الحساب'}
        {!pending && <ArrowRight className="h-5 w-5 rotate-180" />}
      </button>
    </form>
  )
}
