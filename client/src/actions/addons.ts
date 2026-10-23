'use server';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { isMissingSchemaError } from '@/lib/applies-to';

/** نفس قيد القاعدة (ملف 12) — صور Cloudinary بتاعنا بس. */
const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';

/**
 * إدارة الإضافات.
 *
 * الأسعار هنا هي المصدر الوحيد: دالة إنشاء الطلب في القاعدة بتقرا منها،
 * والمتصفح ما بيبعتش أسعار خالص. يعني تعديل السعر من الشاشة دي بيأثر
 * على الطلبات الجديدة بس — الطلبات القديمة محتفظة بنسخة من السعر اللي
 * العميل دفعه وقتها.
 *
 * بترجّع النتيجة بدل ما ترمي الخطأ: Next بيخفي الرسائل المرمية في
 * الإنتاج ويستبدلها بنص إنجليزي عام.
 */
export type AddonResult = { ok: true } | { ok: false; error: string };

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || `addon-${Date.now()}`
  );
}

export async function saveAddon(params: {
  id?: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  /**
   * نوع الإضافة (قرار تامر، ٢٣ أكتوبر): مطبوعة / إلكترونية /
   * الاتنين. الغايب = «مطبوعة» — السلوك اللي كان.
   */
  deliveryFormat?: 'printed' | 'electronic' | 'both';
  /** صورة اختيارية (ملف 12) — فاضي = من غير صورة. */
  imageUrl?: string | null;
  /** ملف 19 — صفحة التفاصيل. */
  galleryImageUrls?: string[];
  longDescription?: string;
  features?: string[];
}): Promise<AddonResult> {
  const admin = await requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة الإضافات');

  const name = params.name.trim();
  if (!name) return { ok: false, error: 'اكتب اسم الإضافة' };

  // ⚠️ القيمة بتتفحص هنا مش بتتبعت زي ما جت: القاعدة عليها قيد
  //    بيرفض أي قيمة تانية، والخطأ ساعتها بيبقى رسالة قيد مش مفهومة.
  const deliveryFormat =
    params.deliveryFormat === 'electronic' || params.deliveryFormat === 'both'
      ? params.deliveryFormat
      : 'printed';
  if (!Number.isFinite(params.price) || params.price < 0) {
    return { ok: false, error: 'السعر غير صحيح' };
  }

  const imageUrl = typeof params.imageUrl === 'string' ? params.imageUrl.trim() : '';
  if (imageUrl && !imageUrl.startsWith(CLOUDINARY_PREFIX)) {
    return { ok: false, error: 'صورة الإضافة لازم تترفع من زرار «رفع صورة» أو المكتبة — مش رابط من برّه' };
  }

  // ملف 19 — نفس حدود القاعدة، برسالة مفهومة بدل خطأ القيد.
  const gallery = (params.galleryImageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (gallery.length > 8) return { ok: false, error: 'الصور الفرعية لحد ٨ صور' };
  if (gallery.some((u) => !u.startsWith(CLOUDINARY_PREFIX))) {
    return { ok: false, error: 'الصور الفرعية لازم تترفع من زرار الرفع أو المكتبة — مش روابط من برّه' };
  }
  const features = (params.features ?? []).map((f) => f.trim()).filter(Boolean);
  if (features.length > 10) return { ok: false, error: 'نقاط التفاصيل لحد ١٠ نقاط' };
  const longDescription = (params.longDescription ?? '').trim();
  if (longDescription.length > 5000) return { ok: false, error: 'الوصف الكامل طويل — لحد ٥٠٠٠ حرف' };
  const hasDetails = gallery.length > 0 || features.length > 0 || longDescription.length > 0;

  const supabase = await createClient();
  const base = {
    name,
    description: params.description.trim() || null,
    price: params.price,
    is_active: params.isActive,
    sort_order: Number.isFinite(params.sortOrder) ? params.sortOrder : 0,
    // ملف 08 (قرار تامر: «التخصيص على الكل»): كل إضافة بتتخصص باسم الطفل
    // وصورته، والسعر واحد شامل التخصيص — فـ«فرق التخصيص» دايمًا صفر.
    // والقاعدة عليها قيد بيرفض إضافة «مابتتخصصش».
    supports_customization: true,
    customization_price: 0,
    updated_at: new Date().toISOString(),
  };
  const withImage = { ...base, image_url: imageUrl || null };
  // ⚠️ نوع الإضافة في طبقة لوحدها (ترحيل ٢٣ أكتوبر): لو العمود لسه
  //    مش موجود على القاعدة، الحفظ بيكمّل من غيره بدل ما شاشة
  //    الإضافات كلها تقف — نفس نمط الصورة والتفاصيل تحت.
  const withFormat = { ...withImage, delivery_format: deliveryFormat };
  const row = {
    ...withFormat,
    gallery_image_urls: gallery.length ? gallery : null,
    long_description: longDescription || null,
    features: features.length ? features : null,
  };

  const write = (r: typeof base) =>
    params.id
      ? supabase.from('addon_products').update(r).eq('id', params.id)
      : supabase.from('addon_products').insert({ ...r, slug: slugify(name) });

  let { error } = await write(row);
  // ⚠️ قبل ملف 19 خانات التفاصيل مش موجودة: نحفظ من غيرها بدل ما تعديل
  //    الإضافات يقف — إلا لو الإدارة كتبت فيها، فنقول بدل ما نضيّعها.
  if (error && isMissingSchemaError(error)) {
    if (hasDetails) return { ok: false, error: 'الصور الفرعية والوصف الكامل محتاجين ملف 19 يتشغّل الأول — احفظ من غيرهم دلوقتي' };
    ({ error } = await write(withFormat));
  }
  // ⚠️ العمود لسه مش متشغّل: الإضافة بتتحفظ «مطبوعة» (السلوك القديم).
  //    وبنقول لو الإدارة كانت بتغيّره فعلًا — السكوت هنا معناه إنها
  //    تفتكر إنها حفظت «إلكترونية» وهي اتحفظت مطبوعة.
  if (error && isMissingSchemaError(error)) {
    if (deliveryFormat !== 'printed') {
      return {
        ok: false,
        error: 'نوع الإضافة محتاج ترحيل ٢٣ أكتوبر يتشغّل الأول — احفظها «مطبوعة» دلوقتي',
      };
    }
    ({ error } = await write(withImage));
  }
  // ⚠️ قبل ملف 12 العمود مش موجود: من غير صورة = السلوك القديم، فنحفظ من
  //    غيره بدل ما تعديل الإضافات يقف لحد ما الملف يتشغّل.
  if (error && isMissingSchemaError(error)) {
    if (imageUrl) return { ok: false, error: 'صورة الإضافة محتاجة ملف 12 يتشغّل الأول — احفظ من غير صورة دلوقتي' };
    ({ error } = await write(base));
  }

  if (error) {
    console.error('Error saving addon', error);
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: params.id ? 'addon_updated' : 'addon_created',
    entityType: 'AddonProduct',
    entityId: params.id ?? name,
    metadata: { price: params.price },
  });

  revalidatePath('/dashboard/admin/addons');
  refreshPublicPages();
  return { ok: true };
}

/**
 * إيقاف الإضافة بدل حذفها.
 *
 * الحذف بيكسر الطلبات القديمة اللي اختارتها. الإيقاف بيشيلها من قدام
 * العميل ويسيب التاريخ زي ما هو.
 */
export async function setAddonActive(id: string, isActive: boolean): Promise<AddonResult> {
  const admin = await requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة الإضافات');

  const supabase = await createClient();
  const { error } = await supabase
    .from('addon_products')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error toggling addon', error);
    return { ok: false, error: `تعذّر التغيير: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: isActive ? 'addon_activated' : 'addon_suspended',
    entityType: 'AddonProduct',
    entityId: id,
  });

  revalidatePath('/dashboard/admin/addons');
  refreshPublicPages();
  return { ok: true };
}
