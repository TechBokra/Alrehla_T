import React from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { AdminPermission } from '@/types';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';
import { AdminSidebarNav, SidebarGroup } from '@/components/admin/AdminSidebarNav';

type RawLink = { label: string; href: string; icon: string; permission: AdminPermission };
type RawGroup = { title: string; links: RawLink[] };

/**
 * تقسيم شاشات الإدارة.
 *
 * التقسيم بالشغل اللي بتعمله مش بالجدول في القاعدة: «مين» و«إيه اللي
 * بنبيعه وبكام» و«اللي بيحصل كل يوم» و«اللي بيتعرض على الموقع»
 * و«الفلوس والسجل».
 */
const GROUPS: RawGroup[] = [
  {
    title: 'الناس',
    links: [
      { label: 'المستخدمون والعائلات', href: '/dashboard/admin/users', icon: 'Users', permission: 'canManageUsers' },
      { label: 'طلبات حذف الحسابات', href: '/dashboard/admin/users/deletion-requests', icon: 'Users', permission: 'canManageUsers' },
      // شاشة الصلاحيات نفسها بتتحقق إن اللي داخل مدير نظام — الصلاحية دي
      // بتخلي الرابط يبان للمشرف العام كمان، وهو هيشوف رسالة «غير مصرح».
      // مقصود: أحسن من رابط مختفي محدش يعرف إنه موجود.
      { label: 'الصلاحيات', href: '/dashboard/admin/users/permissions', icon: 'ShieldAlert', permission: 'canManageUsers' },
      { label: 'المدربون', href: '/dashboard/admin/instructors', icon: 'UserCheck', permission: 'canManageInstructors' },
      // ⚠️ من غير المدخل ده، المنتج المعلَّق بيفضل **واقفًا عن
      //    البيع للأبد** ومافيش مكان في اللوحة يعرضه.
      { label: 'مراجعة المنتجات', href: '/dashboard/admin/products/review', icon: 'ClipboardList', permission: 'canManageCatalog' },
      // ⚠️ الشاشة دي هي اللي بتخلّي الموافقة على الصور حقيقية.
      //    من غير مدخل في القايمة، الصور بتفضل معلَّقة للأبد
      //    والمدرب يفتكر إن الموقع باظ.
      { label: 'مراجعة ملفات المدربين', href: '/dashboard/admin/instructors/review', icon: 'Images', permission: 'canManageInstructors' },
      // مقدّمو الخدمة: المنصة والمدربون والمستقلون. مكان واحد لتحديد
      // مين بيقدّم أي خدمة إبداعية وبكام.
      { label: 'مقدّمو الخدمة', href: '/dashboard/admin/providers', icon: 'UserCheck', permission: 'canManageInstructors' },
      { label: 'الناشرون', href: '/dashboard/admin/publishers', icon: 'BookOpen', permission: 'canManagePublishers' },
      { label: 'طلبات الانضمام', href: '/dashboard/admin/join-requests', icon: 'UserCheck', permission: 'canManageSupport' },
    ],
  },
  {
    title: 'الكتالوج والأسعار',
    links: [
      { label: 'باقات الكتابة', href: '/dashboard/admin/writing/packages', icon: 'LayoutDashboard', permission: 'canManageCatalog' },
      { label: 'الخدمات الإبداعية', href: '/dashboard/admin/writing/services', icon: 'LayoutDashboard', permission: 'canManageCatalog' },
      { label: 'المنتجات والمكتبة', href: '/dashboard/admin/products', icon: 'Box', permission: 'canManagePublishers' },
      { label: 'منتجات المنصة', href: '/dashboard/admin/products/platform', icon: 'Box', permission: 'canManagePublishers' },
      { label: 'إضافات المنتجات', href: '/dashboard/admin/addons', icon: 'Package', permission: 'canManageCatalog' },
      { label: 'ترتيب «أنت البطل هنا»', href: '/dashboard/admin/products/hero-order', icon: 'ListOrdered', permission: 'canManageCatalog' },
      { label: 'خانات التخصيص', href: '/dashboard/admin/products/customization-fields', icon: 'TextCursorInput', permission: 'canManageCatalog' },
      { label: 'خطط صندوق الرحلة', href: '/dashboard/admin/subscriptions/box/plans', icon: 'Package', permission: 'canManageSubscriptions' },
      { label: 'تسعير الكتابة', href: '/dashboard/admin/settings/creative-writing-pricing', icon: 'Settings', permission: 'canManageCatalog' },
      { label: 'تسعير الناشرين', href: '/dashboard/admin/settings/publisher-pricing', icon: 'Settings', permission: 'canManagePublishers' },
      { label: 'أسعار الشحن', href: '/dashboard/admin/settings/shipping', icon: 'Truck', permission: 'canManageOrders' },
    ],
  },
  {
    title: 'الطلبات والتشغيل',
    links: [
      { label: 'طلبات المنتجات', href: '/dashboard/admin/orders', icon: 'ShoppingCart', permission: 'canManageOrders' },
      // كانت شاشة طلبات الخدمات موصولة من جوّه شاشة الطلبات بس.
      { label: 'طلبات الخدمات', href: '/dashboard/admin/orders/services', icon: 'ShoppingCart', permission: 'canManageOrders' },
      { label: 'الحجوزات والجلسات', href: '/dashboard/admin/bookings', icon: 'Calendar', permission: 'canManageBookings' },
      { label: 'الجلسات وتقارير المدربين', href: '/dashboard/admin/sessions', icon: 'ClipboardList', permission: 'canManageBookings' },
      { label: 'الغرف والجلسات المباشرة', href: '/dashboard/admin/rooms', icon: 'Video', permission: 'canManageBookings' },
      { label: 'تقويم الجلسات', href: '/dashboard/admin/bookings/calendar', icon: 'Calendar', permission: 'canManageBookings' },
      { label: 'اشتراكات صندوق الرحلة', href: '/dashboard/admin/subscriptions/box', icon: 'Box', permission: 'canManageSubscriptions' },
      // الشاشتين دول ما كانش ليهم أي رابط في أي مكان — الوصول الوحيد
      // كان بكتابة العنوان بالإيد.
      { label: 'اشتراكات الباقات', href: '/dashboard/admin/subscriptions/courses', icon: 'Box', permission: 'canManageSubscriptions' },
      { label: 'طلبات جلسات الدعم', href: '/dashboard/admin/support/session-requests', icon: 'LifeBuoy', permission: 'canManageSupport' },
      { label: 'رسائل الدعم الفني', href: '/dashboard/admin/support/tickets', icon: 'LifeBuoy', permission: 'canManageSupport' },
    ],
  },
  {
    title: 'المحتوى والموقع',
    links: [
      { label: 'المدونة', href: '/dashboard/admin/content/blog', icon: 'FileText', permission: 'canManageContent' },
      { label: 'محتوى الصفحات', href: '/dashboard/admin/content/pages', icon: 'LayoutDashboard', permission: 'canManageContent' },
      { label: 'صور الموقع', href: '/dashboard/admin/content/images', icon: 'FileText', permission: 'canManageContent' },
      { label: 'مخزن الصور (Cloudinary)', href: '/dashboard/admin/media', icon: 'Images', permission: 'canManageContent' },
      { label: 'آراء العملاء', href: '/dashboard/admin/content/testimonials', icon: 'Quote', permission: 'canManageContent' },
      { label: 'التقييمات', href: '/dashboard/admin/reviews', icon: 'Star', permission: 'canManageContent' },
      // رقم الدفع والـ QR بيتظبطوا من هنا.
      { label: 'الإشعارات', href: '/dashboard/admin/notifications', icon: 'LifeBuoy', permission: 'canManageContent' },
      { label: 'الإعدادات العامة', href: '/dashboard/admin/content/settings', icon: 'Settings', permission: 'canManageContent' },
    ],
  },
  {
    title: 'المالية والسجلات',
    links: [
      { label: 'مستحقات المدربين', href: '/dashboard/admin/finance/instructor-payouts', icon: 'DollarSign', permission: 'canManageFinance' },
      // شاشة موجودة من غير رابط زي أخواتها.
      { label: 'مستحقات الناشرين', href: '/dashboard/admin/finance/publisher-payouts', icon: 'DollarSign', permission: 'canManageFinance' },
      { label: 'طلبات السحب', href: '/dashboard/admin/finance/withdrawals', icon: 'DollarSign', permission: 'canManageFinance' },
      { label: 'السجلات والتدقيق', href: '/dashboard/admin/audit-logs', icon: 'ShieldAlert', permission: 'canViewAuditLogs' },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user.role !== 'super_admin' && user.role !== 'general_supervisor') {
    redirect('/dashboard');
  }

  // الفلترة بتتعمل هنا على السيرفر: الرابط اللي مالكش صلاحيته ما بيوصلش
  // للمتصفح أصلًا. والمجموعة اللي بقت فاضية بتختفي بعنوانها.
  const groups: SidebarGroup[] = GROUPS.map((group) => ({
    title: group.title,
    links: group.links
      .filter((link) => hasAdminPermission(user, link.permission))
      .map(({ label, href, icon }) => ({ label, href, icon })),
  })).filter((group) => group.links.length > 0);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 w-full">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-l border-slate-200 shrink-0 md:min-h-screen flex flex-col">
        <div className="p-6 pb-4">
          <Link href="/dashboard/admin" className="text-xl font-black text-slate-800 hover:text-amber-500 transition-colors">
            لوحة الإدارة
          </Link>
        </div>

        <AdminSidebarNav groups={groups} />

        <div className="p-4 border-t border-slate-200">
          <LogoutButton className="w-full" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}
