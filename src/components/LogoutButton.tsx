'use client'

import { LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { logout } from '@/lib/logout'

export function LogoutButton({ className = '' }: { className?: string }) {
  const [pending, setPending] = useState(false)

  const handleLogout = async () => {
    setPending(true)
    await logout()
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
