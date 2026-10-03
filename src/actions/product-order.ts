'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';

export type OrderResult = { ok: true } | { ok: false; error: string };

/**
 * ترتيب منتجات «أنت البطل هنا» (ملف 06 — ملاحظة فريق العمل ٨).
 *
 * بياخد الترتيب الجديد كله ويكتب 10، 20، 30… — أبسط من «بدّل اتنين»،
 * وبيصلّح نفسه لو كان فيه أرقام متساوية (المنتجات الجديدة كلها صفر).
 *
 * ⚠️ بـ`.eq('category', 'custom')`: حتى لو اتبعت رقم منتج مكتبة بالغلط،
 *    مابيتلمسش — وبيرجع خطأ بدل ما يعدّي في صمت.
 */
export async function saveHeroProductOrder(ids: string[]): Promise<OrderResult> {
  let actor;
  try {
    actor = await requireAdmin('canManageCatalog', 'غير مصرح لك بترتيب المنتجات');
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    return { ok: false, error: 'ترتيب غير صالح' };
  }

  const supabase = await createClient();
  for (const [i, id] of ids.entries()) {
    const { data, error } = await supabase
      .from('personalized_products')
      .update({ sort_order: (i + 1) * 10 })
      .eq('id', id)
      .eq('category', 'custom')
      .select('id');
    if (error || !data || data.length === 0) {
      console.error('تعذّر حفظ ترتيب المنتجات', error);
      return {
        ok: false,
        error: 'الترتيب ما اتحفظش كله — اتأكد إن ملف 06 اتشغّل، وحدّث الصفحة وجرّب تاني',
      };
    }
  }

  await logAuditAction({
    actorProfileId: actor.id,
    actorName: actor.fullName,
    action: 'hero_products_reordered',
    entityType: 'PersonalizedProduct',
    metadata: { count: ids.length },
  });

  revalidatePath('/dashboard/admin/products/hero-order');
  revalidatePath('/enha-lak/custom');
  revalidatePath('/enha-lak');
  revalidatePath('/');
  return { ok: true };
}
