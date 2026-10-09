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
  /** صورة اختيارية (ملف 12) — فاضي = من غير صورة. */
  imageUrl?: string | null;
}): Promise<AddonResult> {
  const admin = await requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة الإضافات');

  const name = params.name.trim();
  if (!name) return { ok: false, error: 'اكتب اسم الإضافة' };
  if (!Number.isFinite(params.price) || params.price < 0) {
    return { ok: false, error: 'السعر غير صحيح' };
  }

  const imageUrl = typeof params.imageUrl === 'string' ? params.imageUrl.trim() : '';
  if (imageUrl && !imageUrl.startsWith(CLOUDINARY_PREFIX)) {
    return { ok: false, error: 'صورة الإضافة لازم تترفع من زرار «رفع صورة» أو المكتبة — مش رابط من برّه' };
  }

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
  const row = { ...base, image_url: imageUrl || null };

  const write = (r: typeof base) =>
    params.id
      ? supabase.from('addon_products').update(r).eq('id', params.id)
      : supabase.from('addon_products').insert({ ...r, slug: slugify(name) });

  let { error } = await write(row);
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
