'use server';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';

/**
 * ⚠️ الأكشنز هنا **بترجّع** النتيجة بدل ما ترمي خطأ.
 * Next في الإنتاج بيخفي رسالة أي خطأ بيترمي من أكشن، فالإدارة كانت بتشوف
 * رسالة إنجليزي عامة بدل «اكتب اسم الباقة». فبنرجّع
 * `{ ok: false, error, field }` والشاشة هي اللي تعرضها.
 */
export type BoxPlanResult = { ok: true } | { ok: false; error: string; field?: string };

const fail = (error: string, field?: string) =>
  ({ ok: false as const, error, ...(field ? { field } : {}) });

/** الحارس بيرمي — هنا بنمسكه ونرجّع رسالته العربي. */
async function guard(message: string) {
  try {
    return {
      ok: true as const,
      admin: await requireAdmin('canManageSubscriptions', message),
    };
  } catch (err) {
    return fail(err instanceof Error && err.message ? err.message : 'غير مصرح');
  }
}

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
  if (!name) return fail('اكتب اسم الباقة', 'name');

  const months = Math.trunc(Number(input.durationMonths));
  if (!Number.isFinite(months) || months < 1) return fail('المدة لا تقل عن شهر', 'durationMonths');

  const total = Number(input.priceTotal);
  const monthly = Number(input.priceMonthly);
  if (!Number.isFinite(total) || total < 0) return fail('السعر الإجمالي غير صحيح', 'priceTotal');
  if (!Number.isFinite(monthly) || monthly < 0) return fail('السعر الشهري غير صحيح', 'priceMonthly');

  // خطأ شائع وسهل: إدخال الشهري في خانة الإجمالي. الرقم بيعدي من غير
  // الفحص ده، والعميل بيشوف سعرًا غلط.
  if (monthly * months < total - 0.01) {
    return fail(
      `السعر الإجمالي (${total}) أكبر من الشهري × المدة (${monthly} × ${months}). راجع الأرقام.`,
      'priceTotal',
    );
  }

  // نفس قيد القاعدة (ملف 140) — عشان الرسالة تبقى مفهومة بدل رفض القاعدة.
  const discount = Math.trunc(Number(input.addonDiscountPercent) || 0);
  if (discount < 0 || discount > 90) return fail('خصم الإضافات من ٠ لـ٩٠٪', 'addonDiscountPercent');

  return {
    ok: true as const,
    row: {
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
    },
  };
}

export async function saveBoxPlan(
  id: string | null,
  input: BoxPlanInput,
): Promise<BoxPlanResult> {
  const auth = await guard('غير مصرح لك بإدارة خطط الصندوق');
  if (!auth.ok) return auth;
  const admin = auth.admin;

  const valid = validate(input);
  if (!valid.ok) return valid;
  const row = valid.row;
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
      return fail('تعذّر حفظ الباقة');
    }
  } else {
    const { error } = await supabase.from('box_subscription_plans').insert(row);
    if (error) {
      console.error('Error creating box plan', error);
      return fail('تعذّر إضافة الباقة');
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
  refreshPublicPages();
  return { ok: true };
}

export async function deleteBoxPlan(id: string): Promise<BoxPlanResult> {
  const auth = await guard('غير مصرح لك بحذف خطط الصندوق');
  if (!auth.ok) return auth;
  const admin = auth.admin;

  const supabase = await createClient();
  const { error } = await supabase
    .from('box_subscription_plans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting box plan', error);
    // اشتراك قايم مربوط بالباقة بيمنع الحذف — وده الصح.
    return fail('تعذّر الحذف. لو فيه اشتراكات على الباقة دي، اقفلها بدل ما تمسحها.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'box_plan_deleted',
    entityType: 'BoxSubscriptionPlan',
    entityId: id,
  });

  revalidatePath('/dashboard/admin/subscriptions/box/plans');
  refreshPublicPages();
  return { ok: true };
}
