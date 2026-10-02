'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, ALL_ADMIN_PERMISSIONS } from '@/data/domains/auth';
import { logAuditAction } from '@/lib/audit';
import { AdminPermission } from '@/types';

/**
 * الأدوار الإدارية بأسماء — «محاسب»، «مسؤول محتوى»، «مسؤول طلبات»…
 *
 * كل دور ليه صلاحياته، وكل إداري بياخد صلاحيات دوره. الدور بيتظبط مرة
 * وبيسري على كل اللي فيه — الموجودين واللي هيتضافوا (schema/05).
 *
 * ⚠️ **كله لمدير النظام وحده** — والقاعدة نفسها بترفض غيره، مش الشاشة
 *    بس. ومدير النظام نفسه مالوش دور يتعدّل: الكل دايمًا، عشان مايقفلش
 *    الباب على نفسه.
 */
export type PermissionsResult = { ok: true } | { ok: false; error: string };

const MISSING_TABLE =
  'جدول الأدوار الإدارية لسه مش موجود — شغّل ملف schema/05 في Supabase الأول.';

const NAME_MIN = 2;
const NAME_MAX = 40;

async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  return actor.role === 'super_admin' ? actor : null;
}

function cleanPermissions(list: AdminPermission[]): AdminPermission[] {
  return [...new Set(list.filter((p) => ALL_ADMIN_PERMISSIONS.includes(p)))];
}

function dbError(error: { code?: string; message?: string }): string {
  if (error.code === '42P01' || error.message?.includes('admin_roles')) {
    return MISSING_TABLE;
  }
  if (error.code === '23505') return 'فيه دور بنفس الاسم ده بالفعل.';
  return `تعذّر الحفظ: ${error.message}`;
}

function refresh() {
  revalidatePath('/dashboard/admin/users/permissions');
  revalidatePath('/dashboard/admin', 'layout');
}

/**
 * إضافة دور إداري جديد، أو تعديل اسم/صلاحيات دور موجود (لو فيه `id`).
 */
export async function saveAdminRole(params: {
  id?: string;
  name: string;
  permissions: AdminPermission[];
}): Promise<PermissionsResult> {
  const actor = await requireSuperAdmin();
  if (!actor) return { ok: false, error: 'تعديل الصلاحيات لمدير النظام فقط' };

  const name = (params.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return {
      ok: false,
      error: `اسم الدور لازم يكون من ${NAME_MIN} لـ ${NAME_MAX} حرف.`,
    };
  }

  const permissions = cleanPermissions(params.permissions ?? []);
  if (permissions.length === 0) {
    return {
      ok: false,
      error:
        'اختار صلاحية واحدة على الأقل — الدور من غير صلاحيات لوحته هتبقى فاضية',
    };
  }

  const supabase = await createClient();
  const row = {
    name,
    permissions,
    updated_at: new Date().toISOString(),
    updated_by: actor.id,
  };

  const query = params.id
    ? supabase.from('admin_roles').update(row).eq('id', params.id)
    : supabase.from('admin_roles').insert(row);

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    console.error('Error saving admin role', error);
    return { ok: false, error: dbError(error) };
  }
  // صفر صفوف = القاعدة رفضت بصمت (قاعدة «و») — مانقولش «تم».
  if (!data) {
    return {
      ok: false,
      error: 'تعذّر حفظ الدور — الدور مش موجود أو الحفظ اترفض.',
    };
  }

  await logAuditAction({
    actorProfileId: actor.id,
    actorName: actor.fullName,
    action: params.id ? 'admin_role_updated' : 'admin_role_created',
    entityType: 'AdminRole',
    entityId: data.id,
    metadata: { name, permissions },
  });

  refresh();
  return { ok: true };
}

/**
 * حذف دور إداري. أصحابه بيرجعوا للدور الافتراضي (القاعدة بتعمل ده).
 * الافتراضي نفسه مايتمسحش.
 */
export async function deleteAdminRole(id: string): Promise<PermissionsResult> {
  const actor = await requireSuperAdmin();
  if (!actor) return { ok: false, error: 'تعديل الصلاحيات لمدير النظام فقط' };
  if (!id) return { ok: false, error: 'الدور مش محدد' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('admin_roles')
    .delete()
    .eq('id', id)
    .eq('is_default', false)
    .select('id, name')
    .maybeSingle();

  if (error) {
    console.error('Error deleting admin role', error);
    return { ok: false, error: dbError(error) };
  }
  if (!data) {
    return { ok: false, error: 'الدور ده مايتمسحش (الافتراضي) أو مش موجود.' };
  }

  await logAuditAction({
    actorProfileId: actor.id,
    actorName: actor.fullName,
    action: 'admin_role_deleted',
    entityType: 'AdminRole',
    entityId: data.id,
    metadata: { name: data.name },
  });

  refresh();
  return { ok: true };
}

/**
 * تحديد الدور الإداري لشخص. `null` = الدور الافتراضي.
 *
 * ⚠️ للإداريين بس (`general_supervisor`) — مدير النظام مالوش دور إداري،
 *    والحساب العادي مالوش لوحة إدارة أصلًا.
 */
export async function assignAdminRole(params: {
  userId: string;
  adminRoleId: string | null;
}): Promise<PermissionsResult> {
  const actor = await requireSuperAdmin();
  if (!actor)
    return { ok: false, error: 'تحديد الأدوار الإدارية لمدير النظام فقط' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      admin_role_id: params.adminRoleId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.userId)
    .eq('role', 'general_supervisor')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error assigning admin role', error);
    if (error.message?.includes('admin_role_id'))
      return { ok: false, error: MISSING_TABLE };
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }
  if (!data) {
    return { ok: false, error: 'الحساب ده مش إداري أو مش موجود.' };
  }

  await logAuditAction({
    actorProfileId: actor.id,
    actorName: actor.fullName,
    action: 'admin_role_assigned',
    entityType: 'UserProfile',
    entityId: params.userId,
    metadata: { adminRoleId: params.adminRoleId ?? 'default' },
  });

  refresh();
  return { ok: true };
}
