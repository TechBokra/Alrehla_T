import { z } from "zod";
import {
  userResourceCreateSchema,
  userResourceUpdateSchema,
  userSuspensionSchema,
  deleteUserSchema,
} from "@/lib/schema";

export const USER_RESOURCE = "users";
export const USER_PROVIDER = "users";

export const userRoleLabels = {
  visitor: "زائر",
  customer: "مستخدم",
  student: "طالب",
  instructor: "مدرّب",
  publisher: "ناشر",
  general_supervisor: "إداري",
  super_admin: "مدير نظام",
  service_provider: "مقدّم خدمة",
} as const;

export const userStatusLabels = {
  active: "شغّال",
  purchase_stopped: "الشراء متوقف",
  fully_suspended: "معلّق بالكامل",
  archived: "مؤرشف",
} as const;

export const userStatusSchema = z.enum([
  "active",
  "purchase_stopped",
  "fully_suspended",
  "archived",
]);
export const userRoleSchema = z.enum([
  "visitor",
  "customer",
  "student",
  "instructor",
  "publisher",
  "general_supervisor",
  "super_admin",
  "service_provider",
]);

export const userRecordSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().nullable().default(""),
  email: z.string().default(""),
  role: userRoleSchema,
  is_guardian: z.boolean().default(false),
  is_child_account: z.boolean().default(false),
  admin_role_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  suspended_at: z.string().nullable(),
  suspension_reason: z.string().nullable(),
  archived_at: z.string().nullable(),
  archived_by: z.string().uuid().nullable(),
  banned_until: z.string().nullable().optional(),
  status: userStatusSchema,
});

export const userRowsSchema = z.object({
  data: z.array(userRecordSchema),
  total: z.number().int().nonnegative(),
});

export const userActivitySchema = z.object({
  total: z.number().int().nonnegative(),
}).passthrough();

export const adminRoleOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_default: z.boolean(),
});

export type UserRecord = z.infer<typeof userRecordSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type UserActivity = z.infer<typeof userActivitySchema>;
export type AdminRoleOption = z.infer<typeof adminRoleOptionSchema>;
export type UserCreateValues = z.infer<typeof userResourceCreateSchema>;
export type UserUpdateValues = z.infer<typeof userResourceUpdateSchema>;
export type UserSuspensionValues = z.infer<typeof userSuspensionSchema>;
export type UserDeleteValues = z.infer<typeof deleteUserSchema>;

export function isAssignableUserRole(value: string): value is Exclude<UserRole, "visitor" | "student" | "instructor"> {
  return ["customer", "service_provider", "publisher", "general_supervisor", "super_admin"].includes(value);
}
