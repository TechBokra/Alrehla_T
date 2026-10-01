'use client'

import { LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '@/actions/auth'
import { clearStoredCart } from '@/lib/cart-storage'

export function LogoutButton({ className = '' }: { className?: string }) {
  const [pending, setPending] = useState(false)

  const handleLogout = async () => {
    setPending(true)
    // السلة المحفوظة فيها اسم الطفل وصورته — اللي بعدك على نفس الجهاز
    // مايشوفهاش (`lib/cart-storage.ts`).
    clearStoredCart()
    await signOut()
    // It redirects so no need to set pending to false
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
