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

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireCatalogAdmin() {
  return requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة الخدمات');
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
  if (!name) throw new Error('اسم الخدمة مطلوب');
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error('السعر غير صحيح');
  }
  if (input.description.trim().length > 300) {
    throw new Error('الوصف القصير أطول من 300 حرف — الباقي مكانه «عن الخدمة»');
  }
  // ملف 09: الصورة والنماذج والوصف الكامل و«هتاخد إيه»…
  const details = cleanServiceDetails(input);
  if (!details.ok) throw new Error(details.error);
  return {
    ...details.row,
    name,
    price: input.price,
    description: input.description.trim() || null,
    category: input.category.trim() || null,
    price_type: input.priceType,
    sort_order: input.sortOrder,
  };
}

export async function createStandaloneService(input: ServiceInput) {
  const user = await requireCatalogAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('standalone_services')
    .insert(validate(input))
    .select('id')
    .single();

  if (error || !data) {
    console.error('Error creating standalone service', error);
    throw new Error('تعذّر إضافة الخدمة');
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
  return { success: true };
}

export async function updateStandaloneService(id: string, input: ServiceInput) {
  const user = await requireCatalogAdmin();
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from('standalone_services')
    .update(validate(input))
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error updating standalone service', error);
    throw new Error('تعذّر حفظ التعديل');
  }
  if (!saved || saved.length === 0) {
    throw new Error('الخدمة مش موجودة — التعديل مروّحش للقاعدة.');
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
  return { success: true };
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
export async function setStandaloneServiceActive(id: string, isActive: boolean) {
  const user = await requireCatalogAdmin();
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from('standalone_services')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error toggling standalone service', error);
    throw new Error(isActive ? 'تعذّر إعادة تفعيل الخدمة' : 'تعذّر إيقاف الخدمة');
  }
  if (!saved || saved.length === 0) {
    throw new Error('الخدمة مش موجودة — التغيير مروّحش للقاعدة.');
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
  return { success: true };
}
