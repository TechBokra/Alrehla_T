import { createClient } from '@/lib/supabase/server';
import { publicIdFromUrl } from '@/lib/cloudinary-admin';

/**
 * كل رابط صورة مستخدَم في القاعدة، وفين بالظبط.
 *
 * ── ليه القايمة مكتوبة بالإيد ───────────────────────────────
 *
 * ⚠️ **أي عمود ناقص من القايمة دي = صورة شغّالة هتبان «مهجورة».**
 *    والحذف مالوش تراجع — فالقايمة دي هي خط الدفاع الوحيد.
 *
 * فبتتعرض **في الشاشة نفسها** عشان الإدارة تقدر تراجعها: لو صورة
 * إنت شايفها في الموقع بتظهر هنا كمهجورة، يبقى في عمود ناقص —
 * قول قبل ما تحذف.
 *
 * ⚠️ **والمطابقة برقم الصورة لا بالرابط.** نفس الصورة ليها روابط
 *    كتير بمقاسات وقصّات مختلفة (صورة الهيرو وحدها ليها تلاتة).
 *    المطابقة بالرابط الكامل كانت هتقول إن كل نسخة صورة مختلفة.
 */
export const SCANNED_COLUMNS: { table: string; column: string; label: string }[] = [
  { table: 'site_settings', column: 'value', label: 'صور الموقع (الإعدادات)' },
  { table: 'personalized_products', column: 'cover_image_url', label: 'أغلفة المنتجات' },
  { table: 'blog_posts', column: 'cover_image_url', label: 'صور المدونة' },
  { table: 'box_subscription_plans', column: 'image_url', label: 'خطط صندوق الرحلة' },
  { table: 'publishers', column: 'logo_url', label: 'شعارات الناشرين' },
  { table: 'user_profiles', column: 'avatar_url', label: 'صور الحسابات' },
  { table: 'child_profiles', column: 'avatar_url', label: 'صور الأطفال' },
  { table: 'service_providers', column: 'avatar_url', label: 'صور مقدّمي الخدمة' },
  { table: 'orders', column: 'payment_receipt_url', label: 'إيصالات طلبات المتجر' },
  { table: 'course_subscriptions', column: 'payment_receipt_url', label: 'إيصالات الباقات' },
  { table: 'service_orders', column: 'payment_receipt_url', label: 'إيصالات الخدمات' },
  { table: 'session_attachments', column: 'file_url', label: 'مرفقات الجلسات' },
  { table: 'join_requests', column: 'portfolio_url', label: 'أعمال طلبات الانضمام' },
];

export type MediaUsage = Map<string, string[]>;

/**
 * خريطة: رقم الصورة ← أماكن استخدامها.
 *
 * ⚠️ **بتقرا بمفتاح الخدمة عن قصد.** الصور بتتخزّن في جداول
 *    صلاحياتها مختلفة (إيصال دفع، صورة طفل)، ولو قرينا بجلسة
 *    الإداري، أي جدول مالوش سياسة قراءة له هيرجع فاضي — وصوره
 *    **تبان مهجورة** (قاعدة «ك»: الصفوف الممنوعة بترجع فاضية لا
 *    بتديك خطأ). والفاضي هنا معناه حذف.
 */
export async function getMediaUsage(): Promise<MediaUsage> {
  const supabase = await createClient();
  const usage: MediaUsage = new Map();

  const note = (url: unknown, label: string) => {
    if (typeof url !== 'string') return;
    const id = publicIdFromUrl(url);
    if (!id) return;
    const places = usage.get(id) ?? [];
    if (!places.includes(label)) places.push(label);
    usage.set(id, places);
  };

  for (const entry of SCANNED_COLUMNS) {
    // `site_settings` عمود JSON فيه خانات الصور — بيتعامل معاه
    // بشكل مختلف عن باقي الأعمدة النصّية.
    if (entry.table === 'site_settings') {
      const { data } = await supabase.from('site_settings').select('value');
      for (const row of data ?? []) {
        const images = (row.value as { images?: Record<string, unknown> })?.images ?? {};
        for (const value of Object.values(images)) note(value, entry.label);
      }
      continue;
    }

    const { data, error } = await supabase
      .from(entry.table as 'orders')
      .select(entry.column);

    if (error) {
      // ⚠️ جدول ما اتقريش = صوره هتبان مهجورة. بنسجّله بصوت عالي.
      console.error('Media scan failed for', entry.table, error);
      continue;
    }

    for (const row of data ?? []) {
      // ⚠️ الجدول والعمود متغيّران، فالنوع المشتقّ مش دقيق هنا —
      //    بنقرا القيمة كمجهولة والفحص الحقيقي في `note` نفسها.
      note((row as unknown as Record<string, unknown>)[entry.column], entry.label);
    }
  }

  return usage;
}
