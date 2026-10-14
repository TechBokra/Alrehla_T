'use server';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import {
  cairoLocalToIso,
  isPromotionTarget,
  validatePromotion,
  type PromotionTarget,
} from '@/lib/promotions';

/**
 * عروض الأسعار المؤقتة من لوحة الإدارة.
 *
 * ⚠️ الحارس الحقيقي في القاعدة: السعر المدفوع بتحسبه `effective_price` جوّه
 *    دوال الطلب، فعرض مسجّل هنا لا يتجاوز أي قاعدة تانية. وسياسة الجدول
 *    (RLS) بتخلّي الكتابة للإدارة وحدها.
 * ⚠️ كل الدوال بترجّع `{ ok, error }` ولا بترمي (قاعدة «هـ»).
 * ⚠️ مفيش حذف: الإيقاف بدل الحذف. والتواريخ بتتكتب بتوقيت القاهرة.
 */
export type PromotionResult = { ok: true } | { ok: false; error: string };

export type PromotionFormInput = {
  targetType: string;
  targetId: string;
  kind: string;
  value: number;
  label?: string;
  /** «YYYY-MM-DDTHH:mm» بتوقيت القاهرة (خانة datetime-local). */
  startsAtLocal: string;
  endsAtLocal: string;
};

async function guard() {
  try {
    return await requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة العروض');
  } catch {
    return null;
  }
}

function refresh() {
  revalidatePath('/dashboard/admin/promotions');
  refreshPublicPages();
}

/** السعر الأصلي للهدف من القاعدة (مش من المتصفح). `null` = الهدف مش موجود. */
async function basePriceOf(type: PromotionTarget, id: string): Promise<number | null> {
  const supabase = await createClient();
  switch (type) {
    case 'product_printed': {
      const { data } = await supabase.from('personalized_products').select('price').eq('id', id).maybeSingle();
      return data ? Number(data.price) : null;
    }
    case 'product_electronic': {
      const { data } = await supabase.from('personalized_products').select('electronic_price').eq('id', id).maybeSingle();
      return data?.electronic_price ? Number(data.electronic_price) : null;
    }
    case 'addon': {
      const { data } = await supabase.from('addon_products').select('price').eq('id', id).maybeSingle();
      return data ? Number(data.price) : null;
    }
    case 'box_plan': {
      const { data } = await supabase.from('box_subscription_plans').select('price_total').eq('id', id).maybeSingle();
      return data ? Number(data.price_total) : null;
    }
  }
}

async function validated(input: PromotionFormInput) {
  const startsAt = cairoLocalToIso(input.startsAtLocal);
  const endsAt = cairoLocalToIso(input.endsAtLocal);
  if (!startsAt || !endsAt) return { ok: false as const, error: 'تاريخ البداية أو النهاية غير صحيح' };
  if (!isPromotionTarget(input.targetType)) return { ok: false as const, error: 'نوع العرض غير معروف' };
  const base = await basePriceOf(input.targetType, (input.targetId ?? '').trim());
  if (base === null) {
    return { ok: false as const, error: 'العنصر المطلوب عليه العرض مش موجود (أو مالوش سعر)' };
  }
  const checked = validatePromotion({ ...input, startsAt, endsAt }, base);
  if (!checked.ok) return checked;
  return { ok: true as const, value: checked.value };
}

export async function createPromotion(input: PromotionFormInput): Promise<PromotionResult> {
  const admin = await guard();
  if (!admin) return { ok: false, error: 'غير مصرح لك بإدارة العروض' };
  const checked = await validated(input);
  if (!checked.ok) return checked;
  const v = checked.value;
  if (new Date(v.endsAt).getTime() <= Date.now()) {
    return { ok: false, error: 'تاريخ النهاية فات بالفعل' };
  }

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from('price_promotions')
    .insert({
      target_type: v.targetType,
      target_id: v.targetId,
      kind: v.kind,
      value: v.value,
      label: v.label,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      is_active: true,
      created_by: admin.id,
    })
    .select('id');
  if (error) {
    console.error('Error creating promotion', error);
    return { ok: false, error: 'تعذّر حفظ العرض' };
  }
  if (!saved || saved.length === 0) return { ok: false, error: 'الحفظ مروّحش للقاعدة — راجع الصلاحيات' };

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'promotion_created',
    entityType: 'PricePromotion',
    entityId: saved[0].id,
    metadata: { ...v },
  });
  refresh();
  return { ok: true };
}

export async function updatePromotion(id: string, input: PromotionFormInput): Promise<PromotionResult> {
  const admin = await guard();
  if (!admin) return { ok: false, error: 'غير مصرح لك بإدارة العروض' };
  if (!id) return { ok: false, error: 'العرض غير محدد' };
  const checked = await validated(input);
  if (!checked.ok) return checked;
  const v = checked.value;

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from('price_promotions')
    .update({
      target_type: v.targetType,
      target_id: v.targetId,
      kind: v.kind,
      value: v.value,
      label: v.label,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('Error updating promotion', error);
    return { ok: false, error: 'تعذّر حفظ العرض' };
  }
  // قاعدة «و»: التعديل على صف مش موجود بينجح ويرجّع صفر صفوف.
  if (!saved || saved.length === 0) return { ok: false, error: 'العرض مش موجود أو الصلاحيات مش سامحة' };

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'promotion_updated',
    entityType: 'PricePromotion',
    entityId: id,
    metadata: { ...v },
  });
  refresh();
  return { ok: true };
}

export async function setPromotionActive(id: string, isActive: boolean): Promise<PromotionResult> {
  const admin = await guard();
  if (!admin) return { ok: false, error: 'غير مصرح لك بإدارة العروض' };
  if (!id) return { ok: false, error: 'العرض غير محدد' };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from('price_promotions')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('Error toggling promotion', error);
    return { ok: false, error: 'تعذّر تغيير حالة العرض' };
  }
  if (!saved || saved.length === 0) return { ok: false, error: 'العرض مش موجود أو الصلاحيات مش سامحة' };

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: isActive ? 'promotion_activated' : 'promotion_paused',
    entityType: 'PricePromotion',
    entityId: id,
    metadata: {},
  });
  refresh();
  return { ok: true };
}
