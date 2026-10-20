'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActiveIntoView } from '@/lib/use-active-into-view';
import { SCROLL_ROW } from '@/lib/scroll-row';

const BASE_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/enha-lak', label: 'إنها لك' },
  { href: '/creative-writing', label: 'بداية الرحلة' },
  { href: '/about', label: 'رحلتنا' },
  { href: '/blog', label: 'المدونة' },
  // «انضم إلينا» نزل للفوتر بس (قرار تامر، 10 أكتوبر) — العميل محتاج
  // الدعم أكتر من رابط التوظيف في القايمة.
  { href: '/support', label: 'الدعم والمساعدة' },
];

/**
 * «أقلام الرحلة» بتظهر في القائمة **لما تتفتح للعامة بس**. الرابط ثابت
 * (من غير عدّاد ولا استعلام)، والهيدر هو اللي بيقرر من إعداداته اللي
 * بيقراها أصلًا.
 */
const AQLAM_LINK = { href: '/aqlam', label: 'أقلام الرحلة' };

function linksFor(showAqlam: boolean) {
  if (!showAqlam) return BASE_LINKS;
  // بعد «بداية الرحلة» مباشرة: القسمين قريبين في الفكرة.
  const i = BASE_LINKS.findIndex((l) => l.href === '/creative-writing');
  return [...BASE_LINKS.slice(0, i + 1), AQLAM_LINK, ...BASE_LINKS.slice(i + 1)];
}

/**
 * روابط القائمة الرئيسية، ومعاها علامة على القسم اللي إنت فيه.
 *
 * القائمة كانت كل روابطها بنفس الشكل بالظبط، فالزائر ما يعرفش هو فين.
 * دلوقتي القسم الحالي بيتلوّن وتحته خط، **ومكتوب فيه `aria-current`**
 * عشان قارئ الشاشة يقول «الصفحة الحالية» — العلامة البصرية وحدها ما
 * بتوصلش لحد بيستخدم قارئ شاشة.
 *
 * المطابقة بالبادئة عشان الصفحات الداخلية تفضل تحت قسمها: `/enha-lak/library`
 * بيفضل مضيّي على «إنها لك». والرئيسية استثناء — بادئتها `/` بتطابق كل
 * حاجة، فبتتطابق بالتساوي بس.
 */
export function NavLinks({ showAqlam = false }: { showAqlam?: boolean }) {
  const pathname = usePathname();
  const LINKS = linksFor(showAqlam);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="hidden gap-1 text-[14px] font-bold text-slate-600 lg:flex">
      {LINKS.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            /* الاستباق مقفول — الشرح في `components/layout/Footer.tsx`. */
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'relative rounded-full bg-white px-4 py-2 text-slate-900 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none'
                : 'relative rounded-full px-4 py-2 transition-all hover:bg-white hover:text-slate-900 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none'
            }
          >
            {link.label}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-amber-500"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * نفس الروابط لشاشات الموبايل — شريط أفقي يتمرّر تحت الهيدر.
 *
 * القائمة الأصلية كانت `hidden lg:flex`، يعني **مفيش قائمة خالص على
 * الموبايل ولا زرار يفتحها**. الزائر على التليفون كان يقدر يوصل للأقسام
 * من الروابط جوّه الصفحة بس.
 */
export function NavLinksMobile({ showAqlam = false }: { showAqlam?: boolean }) {
  const pathname = usePathname();
  const LINKS = linksFor(showAqlam);
  const scroller = useRef<HTMLElement>(null);
  useActiveIntoView(scroller, pathname);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav
      ref={scroller}
      aria-label="أقسام الموقع"
      // ⚠️ الشريط ده عرضه 506 بكسل على شاشة 343 — يعني **رابطين من
      //    الستة بره الشاشة**. الزحليق والتلاشي من `lib/scroll-row`،
      //    وهو اللي بيقول للزائر «فيه كمان» بدل الـscrollbar المخفي.
      className={`mx-auto mt-2 max-w-7xl gap-2 px-2 pb-1 text-[13px] font-bold whitespace-nowrap text-slate-600 lg:hidden ${SCROLL_ROW}`}
    >
      {LINKS.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={active || undefined}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'shrink-0 inline-flex min-h-[44px] items-center rounded-full bg-slate-900 px-4 text-white shadow-sm'
                : 'shrink-0 inline-flex min-h-[44px] items-center rounded-full bg-white/70 px-4 shadow-sm backdrop-blur'
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
