import type { AccessControlProvider, CanParams, CanReturnType } from "@refinedev/core";
import { adminAuthProvider, type AdminAuthorization } from "./auth-provider";

const crudActions = new Set(["list", "show", "create", "edit", "delete"]);
const adminRoles = new Set(["general_supervisor", "super_admin"]);
const deny = (reason = "لا تملك صلاحية تنفيذ هذا الإجراء."): CanReturnType => ({ can: false, reason });

/** Pure UI policy. Supabase RLS and Edge Functions remain authoritative. */
export function evaluateResourceAccess(
  actor: AdminAuthorization | null,
  { resource, action, params }: CanParams,
): CanReturnType {
  if (!actor) return deny("سجّل الدخول بحساب إداري نشط.");
  const id = params?.id;
  const record = params?.record as Record<string, unknown> | undefined;
  if (record && id != null && String(record.id) !== String(id)) return deny();
  const targetId = id ?? record?.id;
  const own = targetId == null || String(targetId) === actor.id;
  if (resource === "profile")
    return own && ["list", "show", "edit"].includes(action) ? { can: true } : deny("يمكنك الوصول إلى ملفك الشخصي فقط.");
  if (resource === "notifications")
    return (params?.recipientId == null || params.recipientId === actor.id) &&
      ["list", "show", "edit", "mark_all_read"].includes(action) ? { can: true } : deny();
  if (resource === "orders") {
    const orderActions = new Set([
      "list",
      "show",
      "start_preparation",
      "mark_shipped",
      "mark_delivered",
      "cancel",
      "mark_electronic_delivery",
      "retry_publisher_earnings",
    ]);
    if (!orderActions.has(action)) return deny("لا توجد صلاحية لهذا الإجراء على الطلبات.");
    return actor.role === "super_admin" || actor.permissions.includes("canManageOrders")
      ? { can: true }
      : deny("لا تملك صلاحية إدارة الطلبات.");
  }
  if (resource === "users") {
    if (["admin_roles", "assign_admin_role"].includes(action))
      return actor.role === "super_admin" ? { can: true } : deny("إسناد الأدوار الإدارية متاح لمدير النظام فقط.");
    if (action === "delete") {
      if (actor.role !== "super_admin") return deny("حذف الحسابات متاح لمدير النظام فقط.");
      if (record && (own || record.archived_at || record.is_child_account || adminRoles.has(String(record.role)))) return deny("هذا الحساب محمي من الحذف.");
      return { can: true };
    }
    if (action === "suspension") {
      if (record && (own || record.archived_at || adminRoles.has(String(record.role)))) return deny("هذا الحساب محمي من الإيقاف.");
      return { can: true };
    }
    if (action === "edit" && record && (record.archived_at || record.is_child_account)) return deny("لا يمكن تعديل هذا الحساب هنا.");
    return ["list", "show", "create", "edit", "activity"].includes(action) ? { can: true } : deny();
  }
  if (resource === "price_promotions") {
    if (!["list", "show", "create", "edit"].includes(action))
      return deny("أوقف العرض بدلًا من حذفه.");
    return actor.role === "super_admin" || actor.permissions.includes("canManageCatalog")
      ? { can: true } : deny("لا تملك صلاحية إدارة العروض.");
  }
  if (["catalog_settings", "customization_fields", "story_goals", "writing_dialects"].includes(resource ?? "")) {
    const allowed = resource === "catalog_settings"
      ? action === "list"
      : resource === "writing_dialects"
        ? ["list", "show", "create", "edit", "delete"].includes(action)
        : ["list", "show", "create", "edit", "delete", "sort"].includes(action);
    if (!allowed) return deny("هذا الإجراء غير متاح لإعدادات الكتالوج.");
    return actor.role === "super_admin" || actor.permissions.includes("canManageCatalog")
      ? { can: true } : deny("لا تملك صلاحية إدارة الكتالوج.");
  }
  const permissions = resource === "personalized_products"
    ? action === "sort"
      ? ["canManageCatalog"]
      : ["canManageCatalog", "canManagePublishers"]
    : resource === "addon_products"
      ? ["canManageCatalog"]
      : resource === "uploads" ? ["canManageContent"] : undefined;
  const knownAction = crudActions.has(action) ||
    ((resource === "personalized_products" || resource === "addon_products") && action === "sort") ||
    (resource === "uploads" && action === "upload");
  if (!permissions || !knownAction) return deny("لا توجد سياسة وصول لهذا المورد أو الإجراء.");
  return actor.role === "super_admin" ||
    permissions.some((permission) => actor.permissions.includes(permission))
    ? { can: true } : deny("لا تملك صلاحية الوصول إلى هذا القسم.");
}

export const supabaseAccessControlProvider: AccessControlProvider = {
  can: async (params) => {
    const version = adminAuthProvider.getSessionVersion();
    if (params.params?.authVersion != null && params.params.authVersion !== version) return deny();
    const actor = await adminAuthProvider.getAuthorization(params.params?.refresh === true);
    if (version !== adminAuthProvider.getSessionVersion()) return deny();
    return evaluateResourceAccess(actor, params);
  },
  options: {
    buttons: { enableAccessControl: true, hideIfUnauthorized: true },
    queryOptions: { staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: "always" },
  },
};

/** Fresh preflight before UI mutations; never a substitute for server checks. */
export async function assertResourceAccess(resource: string, action: string, params?: CanParams["params"]) {
  let result: CanReturnType;
  try {
    result = await supabaseAccessControlProvider.can({ resource, action, params: { ...params, refresh: true } });
  } catch {
    throw new Error("تعذّر التحقق من الصلاحيات. حاول مرة أخرى.");
  }
  if (!result.can) throw new Error(result.reason ?? "لا تملك صلاحية تنفيذ هذا الإجراء.");
}
