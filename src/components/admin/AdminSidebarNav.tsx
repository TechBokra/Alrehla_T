'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, UserCheck, LayoutDashboard, Settings, BookOpen, Box, ShoppingCart,
  Calendar, LifeBuoy, FileText, DollarSign, ShieldAlert, Star, Truck, Quote,
  Package, ClipboardList, Video, Menu, X, LucideIcon,
} from 'lucide-react';

/**
 * قايمة لوحة الإدارة.
 *
 * كانت 26 رابط ورا بعض من غير أي تقسيم، ومن غير أي علامة على الشاشة اللي
 * إنت واقف فيها. دلوقتي مقسّمة لمجموعات حسب الشغل اللي بتعمله، والرابط
 * الحالي متعلّم.
 *
 * الأيقونات بتتبعت بالاسم مش كمكوّن، لأن المكوّنات ما بتعديش من شاشة
 * السيرفر للمتصفح.
 */
const ICONS: Record<string, LucideIcon> = {
  Users, UserCheck, LayoutDashboard, Settings, BookOpen, Box, ShoppingCart,
  Calendar, LifeBuoy, FileText, DollarSign, ShieldAlert, Star, Truck, Quote, Package,
  ClipboardList, Video,
};

export type SidebarLink = { label: string; href: string; icon: string };
export type SidebarGroup = { title: string; links: SidebarLink[] };

export function AdminSidebarNav({ groups }: { groups: SidebarGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // أطول رابط بيطابق بداية العنوان هو المتعلّم — عشان /users ما تفضلش
  // متعلّمة وإنت جوّه /users/deletion-requests.
  const activeHref = React.useMemo(() => {
    const all = groups.flatMap((g) => g.links.map((l) => l.href));
    return all
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0];
  }, [groups, pathname]);

  return (
    <>
      {/* زرار الموبايل — على الشاشات الصغيرة القايمة كانت بتاخد صفحة كاملة
          قبل ما توصل للمحتوى. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-6 pb-4 font-bold text-slate-600 md:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        {open ? 'إغلاق القائمة' : 'القائمة'}
      </button>

      <nav
        className={`${open ? 'flex' : 'hidden'} flex-1 flex-col gap-5 px-4 pb-4 md:flex`}
      >
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-4 pb-1 text-xs font-black uppercase tracking-wide text-slate-400">
              {group.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.links.map((link) => {
                const Icon = ICONS[link.icon] ?? LayoutDashboard;
                const isActive = link.href === activeHref;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
