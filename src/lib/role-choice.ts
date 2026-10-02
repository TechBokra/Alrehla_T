import type { UserRole } from '@/types';

/**
 * قايمة «الدور» في شاشات المستخدمين — **بالأدوار الإدارية بأسمائها**.
 *
 * في القاعدة الإداري دوره `general_supervisor` + عمود `admin_role_id`
 * (schema/05). بس اللي بيختار مايهمّوش ده: هو عايز يختار «محاسب» من نفس
 * القايمة اللي فيها «ناشر». فالقايمة بتعرض كل دور إداري كاختيار لوحده،
 * والقيمة بتتكتب `admin:<رقم الدور>` وبتتفك هنا لدور + دور إداري.
 *
 * ⚠️ **الدور الافتراضي بيتخزّن فاضي (`null`) لا برقمه** — فلو اسمه أو
 *    صلاحياته اتغيّروا، أصحابه بيفضلوا ماشيين عليه.
 */

export type AdminRoleOption = { id: string; name: string; isDefault: boolean };

const PREFIX = 'admin:';

/** القيمة اللي القايمة بتعرضها لشخص. */
export function roleToChoice(
  role: UserRole,
  adminRoleId: string | null | undefined,
  adminRoles: AdminRoleOption[]
): string {
  if (role !== 'general_supervisor' || adminRoles.length === 0) return role;
  const match =
    adminRoles.find((r) => r.id === adminRoleId) ??
    adminRoles.find((r) => r.isDefault);
  return match ? `${PREFIX}${match.id}` : role;
}

/** فكّ الاختيار لدور ودور إداري — `null` لو مش اختيار صالح. */
export function choiceToRole(
  choice: string,
  adminRoles: AdminRoleOption[]
): { role: UserRole; adminRoleId: string | null } | null {
  if (choice.startsWith(PREFIX)) {
    const picked = adminRoles.find((r) => r.id === choice.slice(PREFIX.length));
    if (!picked) return null;
    return {
      role: 'general_supervisor',
      adminRoleId: picked.isDefault ? null : picked.id,
    };
  }
  return { role: choice as UserRole, adminRoleId: null };
}

/** اسم الدور زي ما يتعرض — الإداري باسم دوره الإداري. */
export function roleDisplayName(
  role: UserRole,
  adminRoleId: string | null | undefined,
  adminRoles: AdminRoleOption[],
  labels: Record<string, string>
): string {
  if (role === 'general_supervisor') {
    const match =
      adminRoles.find((r) => r.id === adminRoleId) ??
      adminRoles.find((r) => r.isDefault);
    if (match) return match.name;
  }
  return labels[role] ?? role;
}

/**
 * الاختيارات بالترتيب: الأدوار العادية، ثم الإدارية بأسمائها، ثم مدير النظام.
 * غير مدير النظام مابيشوفش الإدارية خالص (منحها قراره وحده).
 */
export function roleChoices(
  assignable: UserRole[],
  adminRoles: AdminRoleOption[],
  labels: Record<string, string>,
  isSuperAdmin: boolean
): { value: string; label: string }[] {
  const plain = assignable
    .filter((r) => r !== 'general_supervisor' && r !== 'super_admin')
    .map((r) => ({ value: r as string, label: labels[r] ?? r }));
  if (!isSuperAdmin) return plain;

  const admin =
    adminRoles.length > 0
      ? adminRoles.map((r) => ({
          value: `${PREFIX}${r.id}`,
          label: `إداري — ${r.name}`,
        }))
      : [
          {
            value: 'general_supervisor',
            label: labels.general_supervisor ?? 'إداري',
          },
        ];

  return [
    ...plain,
    ...admin,
    { value: 'super_admin', label: labels.super_admin ?? 'مدير نظام' },
  ];
}
