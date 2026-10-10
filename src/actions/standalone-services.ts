'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { logAuditAction } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import { cleanServiceDetails, type ServiceDetailsInput } from '@/lib/service-details';
import { isMissingSchemaError } from '@/lib/applies-to';
import { normalizeKinds, normalizeMaxMb, type FileKind } from '@/lib/private-files';

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

const FILES_NEED_SQL = 'رفع الملفات محتاج ملف 20 يتشغّل على القاعدة الأول — شيل علامة «تسمح برفع ملفات» واحفظ دلوقتي.';

export interface ServiceInput extends ServiceDetailsInput {
  name: string;
  price: number;
  /** الوصف القصير — الكارت في صفحة الخدمات. */
  description: string;
  category: string;
  priceType: 'fixed' | 'starts_from';
  sortOrder: number | null;
  /** ملف 20 — العميل ومقدّم الخدمة يرفعوا ملفات على الطلب. */
  allowsFiles?: boolean;
  fileMaxMb?: number;
  fileKinds?: FileKind[];
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
    files: {
      allows_files: input.allowsFiles === true,
      file_max_mb: normalizeMaxMb(input.fileMaxMb),
      file_kinds: normalizeKinds(input.fileKinds),
    },
  };
}

/**
 * الكتابة مع خانات الملفات (ملف 20) — وقبل الملف ما يتشغّل بنحفظ من
 * غيرها، إلا لو الإدارة فعّلت الملفات فبنقول بدل ما نضيّع الاختيار.
 */
async function writeService<T, R extends object, F extends { allows_files: boolean }>(
  run: (row: R | (R & F)) => PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>,
  valid: { row: R; files: F },
): Promise<{ data: T; error: { code?: string; message?: string } | null; filesNeedSql?: boolean }> {
  const first = await run({ ...valid.row, ...valid.files });
  if (!first.error || !isMissingSchemaError(first.error)) return first;
  if (valid.files.allows_files) return { ...first, filesNeedSql: true };
  return run(valid.row);
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

  const { data, error, filesNeedSql } = await writeService(
    (row) => supabase.from('standalone_services').insert(row).select('id').single(),
    valid,
  );
  if (filesNeedSql) return { ok: false, error: FILES_NEED_SQL };

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
  refreshPublicPages();
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

  const { data: saved, error, filesNeedSql } = await writeService(
    (row) => supabase.from('standalone_services').update(row).eq('id', id).select('id'),
    valid,
  );
  if (filesNeedSql) return { ok: false, error: FILES_NEED_SQL };

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
  refreshPublicPages();
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
  refreshPublicPages();
  return { ok: true };
}
