import type { AdminPermission } from '@/types';

/**
 * تقسيم لوحة الإدارة: **مجموعات ← أقسام ← تبويبات**.
 *
 * ── ليه (ملاحظة تامر: «الأمور ابتدت تبقى زيادة عن اللزوم») ──────
 *
 * القايمة الجانبية كانت **43 رابط**، وكل شاشة جديدة كانت بتاخد رابط
 * لوحدها — حتى لو هي جزء من شاشة تانية (خانات التخصيص وترتيب «أنت البطل
 * هنا» مثلًا جزء من «المنتجات»). دلوقتي:
 *
 *   • القايمة الجانبية = **الأقسام بس** (15)
 *   • جوّه كل قسم = **تبويبات** فوق الصفحة للشاشات اللي تبعه
 *
 * ⚠️ **الشاشات نفسها وعناوينها مااتغيّرتش** — اللي اتغيّر الطريق ليها.
 *    أي رابط محفوظ أو مبعوت (إشعار، رسالة) بيفتح زي ما هو، والقسم والتبويب
 *    بيتعلّموا لوحدهم من العنوان.
 *
 * ⚠️ **الصلاحية على التبويب** — القسم بيظهر لو ليك تبويب واحد فيه على
 *    الأقل، ورابطه بيودّي لأول تبويب مسموح لك. والفلترة على السيرفر: اللي
 *    مالكش صلاحيته مابيوصلش للمتصفح.
 *
 * ⚠️ **أي شاشة جديدة = تبويب في قسم موجود**، مش قسم جديد — إلا لو هي
 *    فعلًا شغل مستقل.
 */

export type AdminTab = { label: string; href: string; permission: AdminPermission };
export type AdminSection = { id: string; label: string; icon: string; tabs: AdminTab[] };
export type AdminGroup = { title: string; sections: AdminSection[] };

/** بعد الفلترة بالصلاحية — اللي بيوصل للمتصفح. */
export type NavTab = { label: string; href: string };
export type NavSection = { id: string; label: string; icon: string; href: string; tabs: NavTab[] };
export type NavGroup = { title: string; sections: NavSection[] };

const A = '/dashboard/admin';

export const ADMIN_NAV: AdminGroup[] = [
  {
    title: 'الناس',
    sections: [
      {
        id: 'users',
        label: 'المستخدمون',
        icon: 'Users',
        tabs: [
          { label: 'المستخدمون والعائلات', href: `${A}/users`, permission: 'canManageUsers' },
          // الشاشة نفسها بتتحقق إن اللي داخل مدير نظام — التبويب بيبان
          // للمشرف العام كمان ويشوف «غير مصرح». أحسن من شاشة محدش يعرفها.
          { label: 'الأدوار والصلاحيات', href: `${A}/users/permissions`, permission: 'canManageUsers' },
          { label: 'طلبات حذف الحسابات', href: `${A}/users/deletion-requests`, permission: 'canManageUsers' },
        ],
      },
      {
        id: 'instructors',
        label: 'المدربون',
        icon: 'UserCheck',
        tabs: [
          { label: 'المدربون', href: `${A}/instructors`, permission: 'canManageInstructors' },
          // ⚠️ من غيرها الملفات والصور بتفضل معلَّقة للأبد.
          { label: 'مراجعة الملفات', href: `${A}/instructors/review`, permission: 'canManageInstructors' },
          { label: 'طلبات الانضمام', href: `${A}/join-requests`, permission: 'canManageSupport' },
        ],
      },
    ],
  },
  {
    title: 'إنها لك',
    sections: [
      // ══ اللي المنصة بتقدّمه ≠ اللي الناشرين بيقدّموه (ملاحظة تامر) ══
      //
      // كانت «كل المنتجات» قايمة واحدة فيها الاتنين. دلوقتي قسمين،
      // وكل منتج بيفتح من قسم مالكه (`/products/platform/<id>` للمنصة،
      // `/products/<id>` للناشر) فالتبويب الصح بيتعلّم.
      {
        id: 'products',
        label: 'منتجات المنصة',
        icon: 'Box',
        tabs: [
          { label: 'المنتجات', href: `${A}/products/platform`, permission: 'canManagePublishers' },
          { label: 'ترتيب «أنت البطل هنا»', href: `${A}/products/hero-order`, permission: 'canManageCatalog' },
          { label: 'خانات التخصيص', href: `${A}/products/customization-fields`, permission: 'canManageCatalog' },
          { label: 'الإضافات', href: `${A}/addons`, permission: 'canManageCatalog' },
        ],
      },
      {
        id: 'publishers',
        label: 'الناشرون',
        icon: 'BookOpen',
        tabs: [
          { label: 'دور النشر', href: `${A}/publishers`, permission: 'canManagePublishers' },
          { label: 'منتجات الناشرين', href: `${A}/products`, permission: 'canManagePublishers' },
          // ⚠️ من غيرها منتج الناشر المعلَّق بيفضل واقف عن البيع للأبد.
          { label: 'مراجعة المنتجات', href: `${A}/products/review`, permission: 'canManageCatalog' },
          { label: 'تسعير الناشرين', href: `${A}/settings/publisher-pricing`, permission: 'canManagePublishers' },
        ],
      },
      {
        id: 'orders',
        label: 'طلبات المنتجات',
        icon: 'ShoppingCart',
        tabs: [
          { label: 'الطلبات', href: `${A}/orders`, permission: 'canManageOrders' },
          { label: 'أسعار الشحن', href: `${A}/settings/shipping`, permission: 'canManageOrders' },
        ],
      },
      {
        id: 'box',
        label: 'صندوق الرحلة',
        icon: 'Package',
        tabs: [
          { label: 'الاشتراكات', href: `${A}/subscriptions/box`, permission: 'canManageSubscriptions' },
          { label: 'الخطط', href: `${A}/subscriptions/box/plans`, permission: 'canManageSubscriptions' },
          { label: 'صناديق الشهر', href: `${A}/subscriptions/box/shipments`, permission: 'canManageSubscriptions' },
        ],
      },
    ],
  },
  {
    title: 'بداية الرحلة',
    sections: [
      {
        id: 'packages',
        label: 'الباقات والاشتراكات',
        icon: 'LayoutDashboard',
        tabs: [
          { label: 'باقات الكتابة', href: `${A}/writing/packages`, permission: 'canManageCatalog' },
          { label: 'اشتراكات الباقات', href: `${A}/subscriptions/courses`, permission: 'canManageSubscriptions' },
          { label: 'تسعير الكتابة', href: `${A}/settings/creative-writing-pricing`, permission: 'canManageCatalog' },
        ],
      },
      {
        id: 'sessions',
        label: 'الجلسات',
        icon: 'Calendar',
        tabs: [
          { label: 'الحجوزات', href: `${A}/bookings`, permission: 'canManageBookings' },
          { label: 'التقويم', href: `${A}/bookings/calendar`, permission: 'canManageBookings' },
          { label: 'الجلسات والتقارير', href: `${A}/sessions`, permission: 'canManageBookings' },
          { label: 'الغرف المباشرة', href: `${A}/rooms`, permission: 'canManageBookings' },
          // «طلب مساعدة في الحجز» من حساب العميل — مكانه مع الجلسات (ملاحظة تامر).
          { label: 'طلبات الجلسات المخصصة', href: `${A}/support/session-requests`, permission: 'canManageSupport' },
        ],
      },
      {
        id: 'services',
        label: 'الخدمات الإبداعية',
        icon: 'Sparkles',
        tabs: [
          { label: 'الخدمات', href: `${A}/writing/services`, permission: 'canManageCatalog' },
          { label: 'الطلبات', href: `${A}/orders/services`, permission: 'canManageOrders' },
          // مين بيقدّم أي خدمة وبكام — المنصة والمدربون والمستقلون.
          { label: 'مقدّمو الخدمة', href: `${A}/providers`, permission: 'canManageInstructors' },
        ],
      },
    ],
  },
  {
    title: 'الموقع',
    sections: [
      {
        id: 'content',
        label: 'المحتوى',
        icon: 'FileText',
        tabs: [
          { label: 'محتوى الصفحات', href: `${A}/content/pages`, permission: 'canManageContent' },
          { label: 'المدونة', href: `${A}/content/blog`, permission: 'canManageContent' },
          { label: 'آراء العملاء', href: `${A}/content/testimonials`, permission: 'canManageContent' },
          { label: 'التقييمات', href: `${A}/reviews`, permission: 'canManageContent' },
        ],
      },
      {
        id: 'images',
        label: 'الصور',
        icon: 'Images',
        tabs: [
          { label: 'صور الموقع', href: `${A}/content/images`, permission: 'canManageContent' },
          { label: 'مخزن الصور', href: `${A}/media`, permission: 'canManageContent' },
        ],
      },
      {
        id: 'settings',
        label: 'الإعدادات',
        icon: 'Settings',
        tabs: [
          // رقم الدفع والـ QR وبيانات التواصل.
          { label: 'الإعدادات العامة', href: `${A}/content/settings`, permission: 'canManageContent' },
          { label: 'الإشعارات', href: `${A}/notifications`, permission: 'canManageContent' },
        ],
      },
    ],
  },
  {
    title: 'الدعم والمالية',
    sections: [
      {
        id: 'support',
        label: 'الدعم',
        icon: 'LifeBuoy',
        tabs: [
          { label: 'رسائل الدعم', href: `${A}/support/tickets`, permission: 'canManageSupport' },
        ],
      },
      {
        id: 'finance',
        label: 'المالية',
        icon: 'DollarSign',
        tabs: [
          { label: 'مستحقات المدربين', href: `${A}/finance/instructor-payouts`, permission: 'canManageFinance' },
          { label: 'مستحقات الناشرين', href: `${A}/finance/publisher-payouts`, permission: 'canManageFinance' },
          { label: 'طلبات السحب', href: `${A}/finance/withdrawals`, permission: 'canManageFinance' },
        ],
      },
      {
        id: 'audit',
        label: 'السجلات والتدقيق',
        icon: 'ShieldAlert',
        tabs: [{ label: 'السجلات والتدقيق', href: `${A}/audit-logs`, permission: 'canViewAuditLogs' }],
      },
    ],
  },
];

/** القايمة بعد الصلاحيات: التبويب الممنوع بيتشال، والقسم الفاضي، والمجموعة الفاضية. */
export function navFor(can: (p: AdminPermission) => boolean, nav: AdminGroup[] = ADMIN_NAV): NavGroup[] {
  return nav
    .map((g) => ({
      title: g.title,
      sections: g.sections
        .map((s) => {
          const tabs = s.tabs.filter((t) => can(t.permission)).map(({ label, href }) => ({ label, href }));
          return { id: s.id, label: s.label, icon: s.icon, href: tabs[0]?.href ?? '', tabs };
        })
        .filter((s) => s.tabs.length > 0),
    }))
    .filter((g) => g.sections.length > 0);
}

/**
 * القسم والتبويب من العنوان — **أطول رابط بيطابق بداية العنوان**.
 *
 * عشان `/dashboard/admin/orders/services/123` يتعلّم «الخدمات الإبداعية ←
 * الطلبات» مش «طلبات المنتجات»، و`/products/review` مش «منتجات الناشرين».
 */
export function activeIn(
  groups: NavGroup[],
  pathname: string,
): { section: NavSection; tab: NavTab } | null {
  let best: { section: NavSection; tab: NavTab } | null = null;
  for (const g of groups) {
    for (const section of g.sections) {
      for (const tab of section.tabs) {
        const hit = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        if (hit && (!best || tab.href.length > best.tab.href.length)) best = { section, tab };
      }
    }
  }
  return best;
}
