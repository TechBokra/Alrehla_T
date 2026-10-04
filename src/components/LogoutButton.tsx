'use client'

import { LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '@/actions/auth'
import { clearStoredCart } from '@/lib/cart-storage'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton({ className = '' }: { className?: string }) {
  const [pending, setPending] = useState(false)

  const handleLogout = async () => {
    if (pending) return
    setPending(true)
    try {
      // السلة المحفوظة فيها اسم الطفل وصورته — اللي بعدك على نفس الجهاز
      // مايشوفهاش (`lib/cart-storage.ts`).
      clearStoredCart()
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    } catch {}

    try {
      await signOut()
    } catch (e: unknown) {
      const err = e as { digest?: string }
      if (err?.digest?.startsWith('NEXT_REDIRECT')) {
        return
      }
    }
    window.location.href = '/'
  }

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-70 ${className}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      <span>تسجيل الخروج</span>
    </button>
  )
}
