'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import { cleanServiceDetails, type ServiceDetailsInput } from '@/lib/service-details';

/**
 * Managing the standalone creative services ("الخدمات الإبداعية").
 *
 * The admin screen used to be a read-only table: there was no way to add,
 * rename, reprice or remove a service from inside the site at all.
 */

/**
 * ⚠️ الأكشنز هنا **بترجّع** النتيجة بدل ما ترمي خطأ.
 * Next في الإنتاج بيخفي رسالة أي خطأ بيترمي من أكشن، فالإدارة كانت بتشوف
 * رسالة إنجليزي عامة بدل «اسم الخدمة مطلوب». فبنرجّع
 * `{ ok: false, error, field }` والشاشة هي اللي تعرضها.
 */
export type StandaloneServiceResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireCatalogAdmin() {
  return requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة الخدمات');
}

/** الحارس بيرمي — هنا بنمسكه ونرجّع رسالته العربي. */
async function guard() {
  try {
    return { ok: true as const, user: await requireCatalogAdmin() };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error && err.message ? err.message : 'غير مصرح',
    };
  }
}

export interface ServiceInput extends ServiceDetailsInput {
  name: string;
  price: number;
  /** الوصف القصير — الكارت في صفحة الخدمات. */
  description: string;
  category: string;
  priceType: 'fixed' | 'starts_from';
  sortOrder: number | null;
}

function validate(input: ServiceInput) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: 'اسم الخدمة مطلوب', field: 'name' };
  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false as const, error: 'السعر غير صحيح', field: 'price' };
  }
  if (input.description.trim().length > 300) {
    return {
      ok: false as const,
      error: 'الوصف القصير أطول من 300 حرف — الباقي مكانه «عن الخدمة»',
      field: 'description',
    };
  }
  // ملف 09: الصورة والنماذج والوصف الكامل و«هتاخد إيه»…
  const details = cleanServiceDetails(input);
  if (!details.ok) return { ok: false as const, error: details.error };
  return {
    ok: true as const,
    row: {
      ...details.row,
      name,
      price: input.price,
      description: input.description.trim() || null,
      category: input.category.trim() || null,
      price_type: input.priceType,
      sort_order: input.sortOrder,
    },
  };
}

export async function createStandaloneService(
  input: ServiceInput,
): Promise<StandaloneServiceResult> {
  const auth = await guard();
  if (!auth.ok) return auth;
  const user = auth.user;
  const valid = validate(input);
  if (!valid.ok) return valid;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('standalone_services')
    .insert(valid.row)
    .select('id')
    .single();

  if (error || !data) {
    console.error('Error creating standalone service', error);
    return { ok: false, error: 'تعذّر إضافة الخدمة' };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'standalone_service_created',
    entityType: 'StandaloneService',
    entityId: data.id,
    metadata: { name: input.name, price: input.price },
  });

  revalidatePath('/dashboard/admin/writing/services');
  revalidatePath('/creative-writing/services');
  revalidatePath('/creative-writing/services/[serviceId]', 'page');
  revalidatePath('/creative-writing');
  return { ok: true };
}

export async function updateStandaloneService(
  id: string,
  input: ServiceInput,
): Promise<StandaloneServiceResult> {
  const auth = await guard();
  if (!auth.ok) return auth;
  const user = auth.user;
  const valid = validate(input);
  if (!valid.ok) return valid;
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from('standalone_services')
    .update(valid.row)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error updating standalone service', error);
    return { ok: false, error: 'تعذّر حفظ التعديل' };
  }
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'الخدمة مش موجودة — التعديل مروّحش للقاعدة.' };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'standalone_service_updated',
    entityType: 'StandaloneService',
    entityId: id,
    metadata: { name: input.name, price: input.price },
  });

  revalidatePath('/dashboard/admin/writing/services');
  revalidatePath('/creative-writing/services');
  revalidatePath('/creative-writing/services/[serviceId]', 'page');
  revalidatePath('/creative-writing');
  return { ok: true };
}

/**
 * إيقاف الخدمة بدل حذفها.
 *
 * كان هنا `DELETE` حقيقي — مخالف لقاعدة المشروع «لا حذف نهائي من واجهة
 * الويب». والحذف كان بيتمنع لو عليها طلبات أو عروض مدربين، يعني الإدارة
 * بتفضل شايفة خدمة قديمة في القايمة ومش قادرة تشيلها ولا توقفها.
 *
 * الإيقاف بيخفيها من الموقع ومن قوائم الطلب، وطلباتها القديمة وعروض
 * المدربين عليها بتفضل زي ما هي — والإدارة تقدر ترجّعها في أي وقت.
 */
export async function setStandaloneServiceActive(
  id: string,
  isActive: boolean,
): Promise<StandaloneServiceResult> {
  const auth = await guard();
  if (!auth.ok) return auth;
  const user = auth.user;
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from('standalone_services')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error toggling standalone service', error);
    return { ok: false, error: isActive ? 'تعذّر إعادة تفعيل الخدمة' : 'تعذّر إيقاف الخدمة' };
  }
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'الخدمة مش موجودة — التغيير مروّحش للقاعدة.' };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: isActive ? 'standalone_service_activated' : 'standalone_service_deactivated',
    entityType: 'StandaloneService',
    entityId: id,
  });

  revalidatePath('/dashboard/admin/writing/services');
  revalidatePath('/creative-writing/services');
  revalidatePath('/creative-writing/services/[serviceId]', 'page');
  revalidatePath('/creative-writing');
  return { ok: true };
}
