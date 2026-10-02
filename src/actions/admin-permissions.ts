'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  getCurrentUser,
  ALL_ADMIN_PERMISSIONS,
  EDITABLE_ADMIN_ROLES,
  type EditableAdminRole,
} from '@/data/domains/auth';
import { logAuditAction } from '@/lib/audit';
import { AdminPermission } from '@/types';

/**
 * صلاحيات الأدوار الإدارية — **على مستوى الدور، مش الشخص**.
 *
 * قبل كده كانت لكل شخص لوحده (عمود في صفّه)، فالمشرف الجديد كان بياخد
 * الافتراضي المكتوب في الكود مش اللي اتظبط. دلوقتي صفّ لكل دور في جدول
 * `role_permissions` (ملف schema/04)، وأي حد في الدور بياخد اللي فيه.
 *
 * ⚠️ **مدير النظام وحده** — والقاعدة نفسها بترفض غيره، مش الشاشة بس.
 *    المشرف العام ممنوع عن قصد: صلاحية تعديل الصلاحيات هي مفتاح
 *    المنصة كلها.
 *
 * ⚠️ **ومدير النظام نفسه مالوش صلاحيات تتعدّل** — دايمًا الكل، عشان
 *    مايقفلش الباب على نفسه.
 */
export type PermissionsResult = { ok: true } | { ok: false; error: string };

export async function updateRolePermissions(params: {
  role: EditableAdminRole;
  permissions: AdminPermission[];
}): Promise<PermissionsResult> {
  const actor = await getCurrentUser();

  if (actor.role !== 'super_admin') {
    return { ok: false, error: 'تعديل الصلاحيات لمدير النظام فقط' };
  }

  if (!(EDITABLE_ADMIN_ROLES as readonly string[]).includes(params.role)) {
    return { ok: false, error: 'الدور ده صلاحياته مابتتعدّلش' };
  }

  const clean = [
    ...new Set(
      params.permissions.filter((p) => ALL_ADMIN_PERMISSIONS.includes(p))
    ),
  ];

  if (clean.length === 0) {
    return {
      ok: false,
      error:
        'اختار صلاحية واحدة على الأقل — الدور من غير صلاحيات لوحته هتبقى فاضية',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permissions')
    .update({
      permissions: clean,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .eq('role', params.role)
    .select('role')
    .maybeSingle();

  if (error) {
    console.error('Error updating role permissions', error);
    if (error.code === '42P01' || error.message?.includes('role_permissions')) {
      return {
        ok: false,
        error:
          'جدول صلاحيات الأدوار لسه مش موجود — شغّل ملف schema/04 في Supabase الأول.',
      };
    }
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }

  // صفر صفوف = القاعدة رفضت بصمت (قاعدة «و») — مانقولش «تم».
  if (!data) {
    return {
      ok: false,
      error: 'تعذّر حفظ صلاحيات الدور — راجع إن ملف schema/04 اتشغّل',
    };
  }

  await logAuditAction({
    actorProfileId: actor.id,
    actorName: actor.fullName,
    action: 'role_permissions_changed',
    entityType: 'Role',
    entityId: params.role,
    metadata: { role: params.role, permissions: clean },
  });

  revalidatePath('/dashboard/admin/users/permissions');
  revalidatePath('/dashboard/admin', 'layout');
  return { ok: true };
}
