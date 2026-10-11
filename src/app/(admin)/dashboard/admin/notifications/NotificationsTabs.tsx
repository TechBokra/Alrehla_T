'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/admin/notifications', label: 'السجل' },
  { href: '/dashboard/admin/notifications/send', label: 'إرسال إشعار' },
  { href: '/dashboard/admin/notifications/types', label: 'الأنواع' },
];

export function NotificationsTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-xl px-4 py-2 font-bold transition-colors ${
              active
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
