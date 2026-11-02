export const ADMIN_USER_ROLES: readonly string[] = ["general_supervisor", "super_admin"];
export const ASSIGNABLE_USER_ROLES: readonly string[] = [
  "customer",
  "service_provider",
  "publisher",
  "general_supervisor",
  "super_admin",
] as const;

export function isActiveUsersAdmin(role: string, archivedAt: unknown): boolean {
  return archivedAt == null && ADMIN_USER_ROLES.includes(role);
}

export function canAssignUserRole(actorRole: string, nextRole: string): boolean {
  return !ADMIN_USER_ROLES.includes(nextRole) || actorRole === "super_admin";
}

export function canChangeUserRole(actorRole: string, currentRole: string, nextRole: string): boolean {
  return !ADMIN_USER_ROLES.includes(currentRole) &&
      !ADMIN_USER_ROLES.includes(nextRole) ||
    actorRole === "super_admin";
}

export function canSuspendUserAccount(
  actorId: string,
  targetId: string,
  targetRole: string,
  archivedAt: unknown,
): boolean {
  return actorId !== targetId && archivedAt == null &&
    !ADMIN_USER_ROLES.includes(targetRole);
}

export function canDeleteUserAccount(input: {
  actorId: string;
  actorRole: string;
  targetId: string;
  targetRole: string;
  isChildAccount: boolean;
  archivedAt: unknown;
}): boolean {
  return input.actorRole === "super_admin" && input.actorId !== input.targetId &&
    !ADMIN_USER_ROLES.includes(input.targetRole) &&
    !input.isChildAccount && input.archivedAt == null;
}
