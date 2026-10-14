'use server';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { validateDialectInput } from '@/lib/writing-style';

/**
 * لهجات الكتابة في «إنها لك» — من لوحة الإدارة بدل ما تتغيّر من القاعدة.
 *
 * ⚠️ كل الدوال بترجّع `{ ok, error }` ولا بترمي (قاعدة «هـ»).
 * ⚠️ إيقاف بدل حذف: الطلبات القديمة محتفظة بكود اللهجة، وبيتعرض اسمها.
 */
export type DialectResult = { ok: true } | { ok: false; error: string };

async function guard() {
  try {
    return await requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة لهجات الكتابة');
  } catch {
    return null;
  }
}

function refresh() {
  revalidatePath('/dashboard/admin/products/writing-dialects');
  refreshPublicPages();
}

export async function addWritingDialect(params: {
  code: string;
  nameAr: string;
}): Promise<DialectResult> {
  const admin = await guard();
  if (!admin) return { ok: false, error: 'غير مصرح لك بإدارة لهجات الكتابة' };
  const checked = validateDialectInput(params.code, params.nameAr);
  if (!checked.ok) return checked;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from('writing_dialects')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: saved, error } = await supabase
    .from('writing_dialects')
    .insert({ code: checked.code, name_ar: checked.nameAr, sort_order: (last?.sort_order ?? 0) + 1 })
    .select('code');
  if (error) {
    console.error('Error adding writing dialect', error);
    if (error.code === '23505') return { ok: false, error: 'الكود ده موجود قبل كده' };
    return { ok: false, error: 'تعذّرت إضافة اللهجة' };
  }
  if (!saved || saved.length === 0) return { ok: false, error: 'الإضافة مروّحتش للقاعدة — راجع الصلاحيات' };

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'writing_dialect_created',
    entityType: 'WritingDialect',
    entityId: checked.code,
    metadata: { nameAr: checked.nameAr },
  });
  refresh();
  return { ok: true };
}

export async function updateWritingDialect(params: {
  code: string;
  nameAr: string;
  isActive: boolean;
}): Promise<DialectResult> {
  const admin = await guard();
  if (!admin) return { ok: false, error: 'غير مصرح لك بإدارة لهجات الكتابة' };
  const checked = validateDialectInput(params.code, params.nameAr);
  if (!checked.ok) return checked;

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from('writing_dialects')
    .update({ name_ar: checked.nameAr, is_active: params.isActive })
    .eq('code', checked.code)
    .select('code');
  if (error) {
    console.error('Error updating writing dialect', error);
    return { ok: false, error: 'تعذّر حفظ اللهجة' };
  }
  // قاعدة «و»: التعديل على صف مش موجود بينجح ويرجّع صفر صفوف.
  if (!saved || saved.length === 0) return { ok: false, error: 'اللهجة مش موجودة أو الصلاحيات مش سامحة' };

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'writing_dialect_updated',
    entityType: 'WritingDialect',
    entityId: checked.code,
    metadata: { nameAr: checked.nameAr, isActive: params.isActive },
  });
  refresh();
  return { ok: true };
}
