'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, ShoppingBag, Calendar, Package, HelpCircle, Bell, User, Settings, PenTool, Inbox,
} from 'lucide-react';

/**
 * قائمة حساب العميل — **مصدر واحد**.
 *
 * ── اللي كان بيحصل ──────────────────────────────────────────
 *
 * كان فيه **قائمتين**: واحدة في `layout.tsx` (بتظهر في كل صفحات
 * الحساب) وواحدة مكتوبة تاني جوّه `page.tsx` نفسها. فصفحة «نظرة عامة»
 * كانت بتعرض القائمتين جنب بعض، بأسماء مختلفة لنفس الوجهة:
 *
 *   «أفراد العائلة» / «عائلتي»
 *   «صندوق الرحلة» / «اشتراكات الصندوق»
 *   «طلبات إنها لك» / «طلبات "إنها لك"»
 *
 * وكل واحدة فيها روابط مش في التانية:
 *   • القائمة الجانبية ما كانش فيها `/account/orders/creative-writing`
 *     خالص — صفحة موجودة ومحدش بيوصل لها من القائمة
 *   • القائمة الجوّانية ما كانش فيها «إعدادات الحساب»
 *
 * وكمان الأسماء ما كانتش بتطابق عناوين الصفحات نفسها: الرابط يقول
 * «حجوزات بداية الرحلة» والصفحة اللي بتفتح عنوانها «الخدمات
 * الإبداعية».
 *
 * ── دلوقتي ──────────────────────────────────────────────────
 *
 * قائمة واحدة، وأسماؤها **هي عناوين الصفحات** بالظبط، والرابط النشط
 * معلَّم — زي ما اتعمل في لوحة الإدارة.
 */

type NavItem = {
  href: string;
  label: string;
  Icon: typeof User;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

/**
 * ⚠️ «طلبات الأبناء» بتظهر لولي الأمر وحده.
 *
 * القايمة كانت **ثابتة**، فالرابط كان بيظهر لكل مستخدم — بما فيهم عميل
 * مالوش أطفال أصلًا (يعني مش ولي أمر). والشاشة نفسها نصّها بيخاطب
 * الأب، فالعميل العادي كان بيفتحها ويلاقي كلامًا مالوش علاقة بيه.
 *
 * و«أفراد العائلة» بتفضل ظاهرة للكل عن قصد: هي **مدخل** إنشاء الملف
 * العائلي، ومنها بيتحوّل العميل لولي أمر.
 */
const groupsFor = (isGuardian: boolean): NavGroup[] => [
  {
    items: [
      { href: '/account', label: 'نظرة عامة', Icon: User },
      { href: '/account/family', label: 'أفراد العائلة', Icon: Users },
      ...(isGuardian
        ? [{ href: '/account/family/requests', label: 'طلبات الأبناء', Icon: Inbox }]
        : []),
      { href: '/account/settings', label: 'إعدادات الحساب', Icon: Settings },
    ],
  },
  {
    title: 'الطلبات والمواعيد',
    items: [
      // الاسم ده هو عنوان الصفحة نفسها. كان مكتوب «طلبات إنها لك».
      { href: '/account/orders/enha-lak', label: 'المنتجات والاشتراكات', Icon: ShoppingBag },
      // الصفحة دي ما كانش ليها رابط في القائمة الجانبية إطلاقًا.
      { href: '/account/orders/creative-writing', label: 'الخدمات الإبداعية', Icon: PenTool },
      { href: '/account/bookings', label: 'المواعيد والجلسات', Icon: Calendar },
    ],
  },
  {
    title: 'الاشتراكات',
    items: [
      { href: '/account/subscriptions/box', label: 'اشتراك صندوق الرحلة', Icon: Package },
      { href: '/account/subscriptions/course', label: 'باقات بداية الرحلة', Icon: Package },
    ],
  },
  {
    title: 'أخرى',
    items: [
      { href: '/account/support', label: 'تذاكر الدعم', Icon: HelpCircle },
      // الإشعارات خارج مساحة الحساب عن قصد: كل الأدوار بتوصلها من نفس
      // المكان. و`/account/notifications` بتحوّل هنا عشان الروابط
      // القديمة تفضل شغّالة.
      { href: '/notifications', label: 'الإشعارات', Icon: Bell },
    ],
  },
];

export function AccountNav({ isGuardian = false }: { isGuardian?: boolean }) {
  const pathname = usePathname() ?? '';
  const GROUPS = groupsFor(isGuardian);

  const isActive = (href: string) => {
    if (href === '/account') return pathname === '/account';
    // `/account/family` ما تفضلش نشطة وإحنا في `/account/family/requests`.
    if (href === '/account/family') return pathname === '/account/family';
    return pathname.startsWith(href);
  };

  return (
    <nav className="space-y-1">
      {GROUPS.map((group, index) => (
        <div key={group.title ?? `group-${index}`}>
          {group.title && (
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
                {group.title}
              </p>
            </div>
          )}
          {group.items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={
                isActive(href)
                  ? 'flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700'
                  : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-amber-600'
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
