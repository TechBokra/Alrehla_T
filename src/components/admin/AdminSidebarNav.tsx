'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, UserCheck, LayoutDashboard, Settings, BookOpen, Box, ShoppingCart,
  Calendar, LifeBuoy, FileText, DollarSign, ShieldAlert, Package, Images, Sparkles,
  Home, Menu, X, LucideIcon,
} from 'lucide-react';
import { activeIn, type NavGroup } from '@/lib/admin-nav';

/**
 * القايمة الجانبية للوحة الإدارة — **الأقسام بس**، والشاشات جوّه كل قسم
 * تبويبات فوق الصفحة (`AdminSectionTabs`). التقسيم كله في `lib/admin-nav`.
 *
 * الأيقونات بتتبعت بالاسم مش كمكوّن، لأن المكوّنات ما بتعديش من شاشة
 * السيرفر للمتصفح.
 */
const ICONS: Record<string, LucideIcon> = {
  Users, UserCheck, LayoutDashboard, Settings, BookOpen, Box, ShoppingCart,
  Calendar, LifeBuoy, FileText, DollarSign, ShieldAlert, Package, Images, Sparkles,
};

export function AdminSidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = React.useState(false);
  const active = React.useMemo(() => activeIn(groups, pathname), [groups, pathname]);
  const onHome = pathname === '/dashboard/admin';

  const item = (href: string, label: string, Icon: LucideIcon, isActive: boolean) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
        isActive ? 'bg-amber-50 text-amber-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );

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
        {open ? 'إغلاق القائمة' : active ? `القائمة — ${active.section.label}` : 'القائمة'}
      </button>

      <nav aria-label="أقسام لوحة الإدارة" className={`${open ? 'flex' : 'hidden'} flex-1 flex-col gap-5 px-4 pb-4 md:flex`}>
        <div className="flex flex-col gap-0.5">{item('/dashboard/admin', 'نظرة عامة', Home, onHome)}</div>
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-4 pb-1 text-xs font-black tracking-wide text-slate-600">{group.title}</p>
            <div className="flex flex-col gap-0.5">
              {group.sections.map((section) =>
                item(
                  section.href,
                  section.label,
                  ICONS[section.icon] ?? LayoutDashboard,
                  active?.section.id === section.id,
                ),
              )}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

/**
 * التبويبات فوق الصفحة — شاشات القسم اللي إنت فيه.
 *
 * ⚠️ بتتحسب من العنوان، فأي صفحة جوّه القسم (تفاصيل طلب، تعديل منتج)
 *    بتشوف تبويبات قسمها والتبويب الصح متعلّم — من غير ما الصفحة نفسها
 *    تعرف حاجة عنها.
 */
export function AdminSectionTabs({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname() ?? '';
  const active = activeIn(groups, pathname);
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  // على الموبايل التبويبات بتتمرّر بالعرض — والتبويب المفتوح ممكن يبقى برّه
  // الشاشة، فالواحد مايعرفش هو فين. بنجيبه قدام العين.
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  if (!active || active.section.tabs.length < 2) return null;

  return (
    <div className="border-b border-slate-200 bg-white px-4 pt-4 md:px-8">
      <p className="mb-2 text-xs font-black text-slate-500">{active.section.label}</p>
      <nav aria-label={`شاشات ${active.section.label}`} className="-mb-px flex gap-1 overflow-x-auto">
        {active.section.tabs.map((tab) => {
          const on = tab.href === active.tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={on ? activeRef : undefined}
              aria-current={on ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${
                on
                  ? 'border-amber-600 text-amber-800'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
