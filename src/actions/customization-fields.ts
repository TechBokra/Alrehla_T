'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { FIELDS_MAX, validateFieldInput } from '@/lib/customization-fields';

/**
 * خانات التخصيص من اللوحة (ملف 06 — ملاحظة فريق العمل ٧).
 *
 * ⚠️ كل المخارج بترجّع `{ ok }` — مفيش `throw` (قاعدة «هـ»: Next بيمسح نصّ
 *    الاستثناء في الإنتاج والإداري بيشوف صفحة خطأ عامة).
 * ⚠️ وكل كتابة بـ`.select()`: الكتابة اللي الصلاحيات ترفضها بترجع صفر صفوف
 *    **من غير خطأ** (قاعدة «ك»)، والشاشة كانت هتقول «اتحفظ».
 */

export type FieldResult = { ok: true } | { ok: false; error: string };

async function guard(): Promise<{ ok: true; userId: string; name: string } | { ok: false; error: string }> {
  try {
    const user = await requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة خانات التخصيص');
    return { ok: true, userId: user.id, name: user.fullName ?? '' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }
}

function refresh() {
  revalidatePath('/dashboard/admin/products/customization-fields');
  // صفحات التخصيص بتقرا الجلسة فمش متخزّنة — بس لو اتخزّنت بعدين، الخانة
  // الجديدة لازم تبان من غير ما نستنى ساعة.
  revalidatePath('/enha-lak/custom/[productSlug]', 'page');
  revalidatePath('/enha-lak/custom-library/[productSlug]', 'page');
  revalidatePath('/enha-lak/custom-subscription/[tierId]', 'page');
}

export async function saveCustomizationField(input: {
  id?: string;
  label: string;
  placeholder?: string;
  isRequired: boolean;
  isActive: boolean;
}): Promise<FieldResult> {
  const g = await guard();
  if (!g.ok) return g;

  const checked = validateFieldInput(input);
  if (!checked.ok) return checked;

  const supabase = await createClient();
  const row = {
    label: checked.label,
    placeholder: checked.placeholder,
    is_required: Boolean(input.isRequired),
    is_active: Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('customization_fields')
      .update(row)
      .eq('id', input.id)
      .select('id');
    if (error) {
      console.error('تعذّر تعديل خانة التخصيص', error);
      return { ok: false, error: 'تعذّر حفظ الخانة — جرّب تاني' };
    }
    if (!data || data.length === 0) {
      return { ok: false, error: 'الخانة مش موجودة — يمكن حد مسحها. حدّث الصفحة.' };
    }
  } else {
    const { data: existing, error: countError } = await supabase
      .from('customization_fields')
      .select('sort_order');
    if (countError) {
      console.error('تعذّر قراءة خانات التخصيص', countError);
      return { ok: false, error: 'تعذّر حفظ الخانة — جرّب تاني' };
    }
    if ((existing ?? []).length >= FIELDS_MAX) {
      return { ok: false, error: `الحد ${FIELDS_MAX} خانة — امسح أو أوقف واحدة الأول` };
    }
    // الجديدة في آخر القايمة.
    const last = Math.max(0, ...(existing ?? []).map((r) => r.sort_order ?? 0));
    const { data, error } = await supabase
      .from('customization_fields')
      .insert({ ...row, sort_order: last + 10 })
      .select('id');
    if (error || !data || data.length === 0) {
      console.error('تعذّر إضافة خانة التخصيص', error);
      return { ok: false, error: 'تعذّر إضافة الخانة — جرّب تاني' };
    }
  }

  await logAuditAction({
    actorProfileId: g.userId,
    actorName: g.name,
    action: input.id ? 'customization_field_updated' : 'customization_field_created',
    entityType: 'CustomizationField',
    entityId: input.id,
    metadata: { label: checked.label },
  });
  refresh();
  return { ok: true };
}

/**
 * مسح خانة.
 *
 * الطلبات القديمة مش بتتأثر: كل طلب حافظ اسم الخانة وإجابتها جوّاه.
 * لو عايز تخفيها مؤقتًا من غير ما تمسحها، «أوقفها» بدل كده.
 */
export async function deleteCustomizationField(id: string): Promise<FieldResult> {
  const g = await guard();
  if (!g.ok) return g;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customization_fields')
    .delete()
    .eq('id', id)
    .select('id, label');
  if (error) {
    console.error('تعذّر مسح خانة التخصيص', error);
    return { ok: false, error: 'تعذّر مسح الخانة — جرّب تاني' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'الخانة مش موجودة — يمكن اتمسحت قبل كده. حدّث الصفحة.' };
  }

  await logAuditAction({
    actorProfileId: g.userId,
    actorName: g.name,
    action: 'customization_field_deleted',
    entityType: 'CustomizationField',
    entityId: id,
    metadata: { label: data[0].label },
  });
  refresh();
  return { ok: true };
}

/** الترتيب الجديد كله — بعد سهم ↑ أو ↓. */
export async function reorderCustomizationFields(ids: string[]): Promise<FieldResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > FIELDS_MAX * 2) {
    return { ok: false, error: 'ترتيب غير صالح' };
  }

  const supabase = await createClient();
  for (const [i, id] of ids.entries()) {
    const { data, error } = await supabase
      .from('customization_fields')
      .update({ sort_order: (i + 1) * 10 })
      .eq('id', id)
      .select('id');
    if (error || !data || data.length === 0) {
      console.error('تعذّر حفظ ترتيب الخانات', error);
      return { ok: false, error: 'الترتيب ما اتحفظش كله — حدّث الصفحة وجرّب تاني' };
    }
  }
  refresh();
  return { ok: true };
}
