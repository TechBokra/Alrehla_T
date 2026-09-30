'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useActiveIntoView } from '@/lib/use-active-into-view';

interface Tab {
  name: string;
  href: string;
}

interface SectionSubNavProps {
  tabs: Tab[];
  activeColorClass?: string;
}

/**
 * القائمة الفرعية لأقسام الموقع (الباقات · عن البرنامج · المدربون…).
 *
 * ── تلات أعطال اتقفلت هنا، كلها متقيسة ──────────────────────
 *
 * **① التبويب الحالي كان بره الشاشة.** على موبايل 375 بكسل في صفحة
 *    الخدمات: عرض المحتوى 475، عرض الشاشة 343، و`scrollLeft` صفر —
 *    فالتبويب الحالي عند `left = −115`. الزائر بيفتح الصفحة فيلاقي
 *    تبويبات مفيش فيها واحد متعلَّم. بقى بيتجرّ لنص الشاشة.
 *
 * **② القايمة كانت بتختفي تحت الهيدر وإنت بتنزل.** كانت `top-88px`،
 *    والهيدر على الموبايل **135.5 بكسل** مش 88 — لأن تحته صفّ روابط
 *    الأقسام (`NavLinksMobile`) وهو `lg:hidden`. يعني الرقم كان
 *    مظبوط على اللابتوب وغلط على التليفون، وأغلب الزوار على التليفون.
 *
 *    ⚠️ **والدرس إن رقم ثابت لارتفاع عنصر بيتغيّر مع المقاس بيبقى
 *       صح على مقاس واحد بس.** بقى رقمين، كل واحد لمقاسه.
 *
 * **③ مفيش علامة إن فيه تبويبات على الجنب.** الـscrollbar مخفي عن
 *    قصد (شكله وحش)، فالنتيجة شريط مقصوص بلا أي إشارة. التلاشي على
 *    الطرفين بيقول «فيه كمان» من غير scrollbar.
 */
export function SectionSubNav({
  tabs,
  activeColorClass = 'bg-sky-600 text-white',
}: SectionSubNavProps) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  useActiveIntoView(scroller, pathname);

  return (
    <nav
      aria-label="القائمة الفرعية"
      // ⚠️ الارتفاع من `--subnav-top` لا من رقم مكتوب: الرقم ده مجموع
      //    الهيدر + صفّ قائمة الموقع، والصفّ ده بيتطوى عند النزول.
      //    لو فضل رقمًا ثابتًا، الطيّ كان هيسيب **فراغًا أبيض معلّقًا**
      //    مكان الصفّ المطويّ.
      className="sticky top-[var(--subnav-top)] z-40 w-full border-b border-slate-200/40 bg-white/50 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div
          ref={scroller}
          className={cn(
            'hide-scrollbar flex w-full overflow-x-auto py-3 md:justify-start md:py-4',
            // التلاشي على الطرفين — بديل الـscrollbar المخفي.
            '[mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]',
            'md:[mask-image:none]',
          )}
        >
          <div className="flex items-center gap-3 whitespace-nowrap">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname === tab.href + '/';
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  data-active={isActive || undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-[44px] shrink-0 items-center rounded-full px-5 text-sm font-bold transition-[background-color,box-shadow] duration-200 ease-[var(--ease-ui)] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none md:px-6',
                    isActive
                      ? activeColorClass + ' shadow-md'
                      : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm',
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
