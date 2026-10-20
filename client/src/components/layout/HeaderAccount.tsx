'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, User } from 'lucide-react';
import { AccountMenu } from '@/components/layout/AccountMenu';
import type { UserRole } from '@/types';

type Session = {
  role: UserRole;
  fullName: string;
  unreadCount: number;
  dashboardLabel?: string;
};

const DASHBOARD_LABEL: Partial<Record<UserRole, string>> = {
  customer: 'حسابي',
  student: 'حساب مستخدم',
  instructor: 'لوحة المدرب',
  service_provider: 'لوحة مقدّم الخدمة',
  publisher: 'لوحة الناشر',
  super_admin: 'لوحة الإدارة',
  general_supervisor: 'لوحة الإدارة',
};

const ACCOUNT_HREF: Partial<Record<UserRole, string>> = {
  visitor: '/sign-in',
  customer: '/account',
  student: '/dashboard/student',
  instructor: '/dashboard/instructor',
  service_provider: '/dashboard/provider',
  publisher: '/dashboard/publisher',
  super_admin: '/dashboard/admin',
  general_supervisor: '/dashboard/admin',
};

/**
 * الجزء الوحيد في الهيدر اللي بيختلف من مستخدم لمستخدم.
 *
 * كان الهيدر كله بيتبني على الخادم، وبيقرا الكوكيز عشان يعرف مين داخل.
 * وده كان بيمنع تخزين **كل صفحة في الموقع** مؤقتًا، حتى الصفحات اللي
 * محتواها واحد للجميع.
 *
 * دلوقتي الهيدر ثابت، والمكوّن ده بيسأل عن حالة المستخدم بعد ما الصفحة
 * تظهر. المساحة محجوزة بعرض ثابت أثناء الانتظار عشان الصفحة ما تهتزش
 * لما الزرار يظهر.
 */
export function HeaderAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    fetch('/api/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Session | null) => {
        if (alive && data) setSession(data);
      })
      .catch(() => {
        // فشل الشبكة يعني نفضل على حالة الزائر — مش خطأ يتعرض.
        if (alive) setSession({ role: 'visitor', fullName: '', unreadCount: 0 });
      });
    return () => {
      alive = false;
    };
    // إعادة السؤال بعد كل انتقال: تسجيل الدخول والخروج بيغيّروا الحالة.
  }, [pathname]);

  // أثناء الانتظار: مساحة بنفس مقاس الزرار، بلا نص — عشان مفيش قفزة.
  if (!session) {
    return (
      <div
        className="h-10 w-24 animate-pulse rounded-full bg-slate-200/70"
        aria-hidden="true"
      />
    );
  }

  const isVisitor = session.role === 'visitor';

  if (isVisitor) {
    return (
      <Link
        href="/sign-in"
        prefetch={false}
        className="flex h-11 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-bold text-white shadow-md transition-all hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-500/20 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">دخول</span>
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/notifications"
        prefetch={false}
        aria-label={
          session.unreadCount > 0
            ? `الإشعارات، ${session.unreadCount} غير مقروء`
            : 'الإشعارات'
        }
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-white hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
      >
        <Bell className="h-5 w-5" />
        {session.unreadCount > 0 && (
          <span className="bg-brand text-brand-ink absolute top-1 left-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black">
            {session.unreadCount > 9 ? '9+' : session.unreadCount}
          </span>
        )}
      </Link>

      <div className="hidden h-6 w-px bg-slate-200 sm:block" />

      <AccountMenu
        accountHref={ACCOUNT_HREF[session.role] ?? '/account'}
        dashboardLabel={session.dashboardLabel || DASHBOARD_LABEL[session.role] || 'حسابي'}
        displayName={session.fullName}
      />
    </>
  );
}
