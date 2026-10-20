'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * شريط تنقّل موحّد للوحات الأدوار.
 *
 * قبل كده: لوحة الأدمن هي الوحيدة اللي كان ليها قايمة. المدرب والناشر
 * والطالب ومقدّم الخدمة كانوا بيتنقّلوا بروابط متناثرة جوّه الصفحات —
 * ولو الرابط مش موجود في الصفحة اللي واقف فيها، الشاشة مش موجودة
 * بالنسبة له.
 *
 * شريط تبويبات مش قايمة جانبية: الأدوار دي شاشاتها قليلة (٣–٦)، والشريط
 * بياخد مساحة أقل على الموبايل.
 */
export type DashboardTab = { href: string; label: string };

export function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  const pathname = usePathname();

  // أطول رابط بيطابق بداية العنوان هو المتعلّم — عشان الرئيسية ما
  // تفضلش متعلّمة وإنت جوّه شاشة فرعية.
  const active = tabs
    .map((t) => t.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-6">
        {tabs.map((tab) => {
          const isActive = tab.href === active;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-4 py-4 text-sm font-bold transition-colors ${
                isActive
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
