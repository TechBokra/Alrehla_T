'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';

export interface BoxPlanInput {
  name: string;
  priceTotal: number;
  priceMonthly: number;
  durationMonths: number;
  savingsNote: string;
  description: string;
  imageUrl: string;
  features: string[];
  isHighlighted: boolean;
  isActive: boolean;
  sortOrder: number;
  /** ملف 140: خصم المشترك على الإضافات (٠–٩٠). */
  addonDiscountPercent: number;
  /** ملف 140: الإضافة المجانية في كل صندوق — فاضي = مفيش. */
  freeAddonId: string;
}

/**
 * خطط صندوق الرحلة.
 *
 * الشاشة القديمة كانت جدول عرض فقط — بتقرا الخطط وبس. مفيش إضافة ولا
 * تعديل ولا حذف، فكان تغيير سعر باقة يحتاج مبرمج.
 */
function validate(input: BoxPlanInput) {
  const name = input.name.trim();
  if (!name) throw new Error('اكتب اسم الباقة');

  const months = Math.trunc(Number(input.durationMonths));
  if (!Number.isFinite(months) || months < 1) throw new Error('المدة لا تقل عن شهر');

  const total = Number(input.priceTotal);
  const monthly = Number(input.priceMonthly);
  if (!Number.isFinite(total) || total < 0) throw new Error('السعر الإجمالي غير صحيح');
  if (!Number.isFinite(monthly) || monthly < 0) throw new Error('السعر الشهري غير صحيح');

  // خطأ شائع وسهل: إدخال الشهري في خانة الإجمالي. الرقم بيعدي من غير
  // الفحص ده، والعميل بيشوف سعرًا غلط.
  if (monthly * months < total - 0.01) {
    throw new Error(
      `السعر الإجمالي (${total}) أكبر من الشهري × المدة (${monthly} × ${months}). راجع الأرقام.`,
    );
  }

  // نفس قيد القاعدة (ملف 140) — عشان الرسالة تبقى مفهومة بدل رفض القاعدة.
  const discount = Math.trunc(Number(input.addonDiscountPercent) || 0);
  if (discount < 0 || discount > 90) throw new Error('خصم الإضافات من ٠ لـ٩٠٪');

  return {
    name,
    addon_discount_percent: discount,
    free_addon_id: input.freeAddonId.trim() || null,
    price_total: total,
    price_monthly: monthly,
    duration_months: months,
    savings_note: input.savingsNote.trim() || null,
    description: input.description.trim() || null,
    image_url: input.imageUrl.trim() || null,
    features: input.features.map((f) => f.trim()).filter(Boolean),
    is_highlighted: Boolean(input.isHighlighted),
    is_active: Boolean(input.isActive),
    sort_order: Math.trunc(Number(input.sortOrder)) || 0,
    updated_at: new Date().toISOString(),
  };
}

export async function saveBoxPlan(id: string | null, input: BoxPlanInput) {
  const admin = await requireAdmin(
    'canManageSubscriptions',
    'غير مصرح لك بإدارة خطط الصندوق',
  );

  const row = validate(input);
  const supabase = await createClient();

  // «الأكثر اختيارًا» لواحدة بس — فيه فهرس في قاعدة البيانات بيمنع
  // الاتنين، فبنفكّ القديمة الأول وإلا الحفظ بيترفض برسالة غامضة.
  if (row.is_highlighted) {
    const clear = supabase
      .from('box_subscription_plans')
      .update({ is_highlighted: false })
      .eq('is_highlighted', true);
    if (id) clear.neq('id', id);
    await clear;
  }

  if (id) {
    const { error } = await supabase
      .from('box_subscription_plans')
      .update(row)
      .eq('id', id);
    if (error) {
      console.error('Error updating box plan', error);
      throw new Error('تعذّر حفظ الباقة');
    }
  } else {
    const { error } = await supabase.from('box_subscription_plans').insert(row);
    if (error) {
      console.error('Error creating box plan', error);
      throw new Error('تعذّر إضافة الباقة');
    }
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: id ? 'box_plan_updated' : 'box_plan_created',
    entityType: 'BoxSubscriptionPlan',
    entityId: id ?? row.name,
  });

  revalidatePath('/dashboard/admin/subscriptions/box/plans');
  revalidatePath('/enha-lak/subscription');
  revalidatePath('/enha-lak');
  return { ok: true };
}

export async function deleteBoxPlan(id: string) {
  const admin = await requireAdmin(
    'canManageSubscriptions',
    'غير مصرح لك بحذف خطط الصندوق',
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from('box_subscription_plans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting box plan', error);
    // اشتراك قايم مربوط بالباقة بيمنع الحذف — وده الصح.
    throw new Error('تعذّر الحذف. لو فيه اشتراكات على الباقة دي، اقفلها بدل ما تمسحها.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'box_plan_deleted',
    entityType: 'BoxSubscriptionPlan',
    entityId: id,
  });

  revalidatePath('/dashboard/admin/subscriptions/box/plans');
  revalidatePath('/enha-lak/subscription');
  return { ok: true };
}
