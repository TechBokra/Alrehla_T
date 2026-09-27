'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Tab {
  name: string;
  href: string;
}

interface SectionSubNavProps {
  tabs: Tab[];
  activeColorClass?: string;
}

export function SectionSubNav({
  tabs,
  activeColorClass = 'bg-sky-600 text-white',
}: SectionSubNavProps) {
  const pathname = usePathname();

  return (
    /* ⚠️ `top-24` = 96 بكسل، والهيدر بينتهي عند 88 — فكان بيفضل
       شريط 8 بكسل من محتوى الصفحة بيعدّي بينهم وإنت بتنزل. بقى
       ملزوقًا تحته بالظبط.

       و`mb-8` اتشالت: أول قسم في الصفحة بياخد فراغه من
       `PageContainer` أصلًا، والاتنين مع بعض كانوا بيعملوا فجوة
       مضاعفة تحت القايمة. */
    <nav aria-label="القائمة الفرعية" className="w-full border-b border-slate-200/40 bg-white/50 backdrop-blur-xl sticky top-[5.5rem] z-40">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="hide-scrollbar flex w-full justify-center overflow-x-auto py-4 md:justify-start">
          <div className="flex items-center gap-3 whitespace-nowrap">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname === tab.href + '/';
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'inline-flex min-h-[44px] items-center rounded-full px-6 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-ui)]',
                    isActive
                      ? activeColorClass + ' shadow-md scale-105'
                      : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                  )}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
