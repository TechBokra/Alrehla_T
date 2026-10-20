import 'server-only';
import { publicIdFromUrl } from '@/lib/cloudinary-admin';
import { isAdminApiConfigured, createAdminClient } from '@/lib/supabase/admin';
import { fetchAllPages } from '@/lib/fetch-all';

/**
 * كل صورة مستخدَمة في القاعدة، وفين بالظبط.
 *
 * ⚠️ **أي مكان ناقص = صورة شغّالة هتبان «مهجورة»، والحذف مالوش تراجع.**
 *
 * ── اللي اتغيّر (مراجعة م. محمد — أولوية عالية) ──────────────────
 *
 * كانت قايمة **أعمدة** مكتوبة بالإيد، وكانت ناقصة: صور معرض المنتجات
 * (`gallery_image_urls`)، وصور المدربين (`instructor_media`)، وصور الإضافات
 * والخدمات، والصور جوه نص المقالات، ومسودّات الناشرين. وكان بيكمّل لو
 * جدول فشل، ويقرا بجلسة الإداري (والصفوف الممنوعة بترجع فاضية من غير خطأ).
 *
 * دلوقتي:
 *   • **بنقرا الصف كله** في كل جدول ممكن يكون فيه صورة، ونطلّع أي رابط
 *     Cloudinary من أي خانة (نص، قايمة، JSON) — عمود جديد مابيتنسيش.
 *   • **بمفتاح الخدمة** وعلى دفعات (من غير حد الـ١٠٠٠ صف).
 *   • **لو أي جدول فشل، الفحص «ناقص»** — والحذف بيتقفل خالص.
 *
 * ⚠️ والمطابقة برقم الصورة لا بالرابط: نفس الصورة ليها روابط بمقاسات كتير.
 */
export const SCANNED_TABLES: { table: string; label: string }[] = [
  { table: 'site_settings', label: 'صور الموقع والإعدادات' },
  { table: 'page_content', label: 'نصوص الصفحات' },
  { table: 'personalized_products', label: 'المنتجات (الغلاف والمعرض والمسودّات)' },
  { table: 'addon_products', label: 'الإضافات' },
  { table: 'standalone_services', label: 'الخدمات الإبداعية' },
  { table: 'blog_posts', label: 'المدونة (الغلاف وصور المقال)' },
  { table: 'box_subscription_plans', label: 'خطط صندوق الرحلة' },
  { table: 'box_subscriptions', label: 'اشتراكات الصندوق' },
  { table: 'publishers', label: 'الناشرين' },
  { table: 'user_profiles', label: 'صور الحسابات' },
  { table: 'child_profiles', label: 'صور الأطفال' },
  { table: 'service_providers', label: 'مقدّمي الخدمة' },
  { table: 'instructor_media', label: 'صور المدربين وأعمالهم' },
  { table: 'profile_update_requests', label: 'طلبات تعديل ملفات المدربين' },
  { table: 'testimonials', label: 'آراء العملاء' },
  { table: 'orders', label: 'طلبات المتجر' },
  { table: 'order_items', label: 'تخصيص الطلبات' },
  { table: 'course_subscriptions', label: 'حجوزات الباقات' },
  { table: 'service_orders', label: 'طلبات الخدمات' },
  { table: 'service_order_messages', label: 'رسايل طلبات الخدمات' },
  { table: 'session_attachments', label: 'مرفقات الجلسات' },
  { table: 'portfolio_documents', label: 'محافظ الطلاب' },
  { table: 'join_requests', label: 'طلبات الانضمام' },
];

export type MediaUsage = Map<string, string[]>;

export type MediaScan = {
  usage: MediaUsage;
  /** كل الجداول اتقرت بالكامل. لو `false` **الحذف ممنوع**. */
  complete: boolean;
  /** الجداول اللي ماتقرتش (للعرض في الشاشة). */
  failed: string[];
};

const CLOUDINARY_URL = /https?:\/\/res\.cloudinary\.com\/[^\s"'()<>\\]+/g;

/** أرقام صور Cloudinary في أي قيمة (صف كامل، JSON، نص مقال، قايمة). */
export function cloudinaryIdsIn(value: unknown): string[] {
  const ids = (JSON.stringify(value ?? null).match(CLOUDINARY_URL) ?? [])
    .map((u) => publicIdFromUrl(u))
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

/** كل الصور المستخدَمة + هل الفحص كامل. */
export async function getMediaScan(): Promise<MediaScan> {
  const usage: MediaUsage = new Map();
  if (!isAdminApiConfigured()) {
    return { usage, complete: false, failed: ['مفتاح الخدمة مش متظبط على الخادم'] };
  }
  const supabase = createAdminClient();
  const failed: string[] = [];

  const note = (id: string, label: string) => {
    const places = usage.get(id) ?? [];
    if (!places.includes(label)) places.push(label);
    usage.set(id, places);
  };

  for (const { table, label } of SCANNED_TABLES) {
    const { data, error } = await fetchAllPages((from, to) =>
      supabase
        .from(table as 'orders')
        .select('*')
        .range(from, to),
    );
    if (error) {
      // ⚠️ جدول ما اتقريش = صوره هتبان مهجورة ← الفحص ناقص والحذف مقفول.
      console.error('Media scan failed for', table, error);
      failed.push(label);
      continue;
    }
    for (const row of data) {
      // Completed requests are history, not a live claim on a previous avatar.
      // Pending requests must retain their image throughout moderation.
      const reference = table === 'profile_update_requests' &&
        (row as unknown as { status: string }).status !== 'pending'
        ? { ...row, requested_changes: {
            ...((row as unknown as { requested_changes: Record<string, unknown> }).requested_changes ?? {}),
            avatarUrl: undefined,
          } }
        : row;
      for (const id of cloudinaryIdsIn(reference)) note(id, label);
    }
  }

  return { usage, complete: failed.length === 0, failed };
}
