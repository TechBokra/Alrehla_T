'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { User, LogOut, LayoutDashboard, Loader2, ChevronDown } from 'lucide-react';
import { signOut } from '@/actions/auth';
import { clearStoredCart } from '@/lib/cart-storage';

interface Props {
  /** Where "حسابي" leads for this role. */
  accountHref: string;
  /** Label of the dashboard link, e.g. "لوحة الإدارة". */
  dashboardLabel: string;
  displayName: string;
}

/**
 * The account button in the site header, for a signed-in user.
 *
 * Until now signing out was only possible from a few dashboard pages: a
 * customer in their account area, for example, had no way to sign out at all.
 * The header is present on every page, so this is where it belongs.
 */
export function AccountMenu({ accountHref, dashboardLabel, displayName }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-bold text-white shadow-md transition-all hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-500/20 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">حسابي</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-black text-slate-800">{displayName}</p>
          </div>

          <Link
            href={accountHref}
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LayoutDashboard className="h-4 w-4 text-slate-400" />
            {dashboardLabel}
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              // السلة المحفوظة فيها اسم الطفل وصورته (`lib/cart-storage.ts`).
              clearStoredCart();
              await signOut();
            }}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-70"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  );
}
