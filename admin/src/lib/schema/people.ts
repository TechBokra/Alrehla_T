import { z } from "zod";
import {
  emailSchema,
  moneySchema,
  profileIdSchema,
  recordIdSchema,
  requiredTextSchema,
  textSchema,
  optionalCloudinaryUrlSchema,
  optionalHttpUrlSchema,
  cairoDateTimeSchema,
  instantSchema,
} from "./common";

// Sources: actions/admin-users, admin-permissions, admin-instructors, instructors, providers.
export const assignableRoleSchema = z.enum([
  "customer",
  "service_provider",
  "publisher",
  "general_supervisor",
  "super_admin",
]);
export const adminPermissionSchema = z.enum([
  "canManageUsers",
  "canManageInstructors",
  "canManagePublishers",
  "canManageCatalog",
  "canManageSubscriptions",
  "canManageOrders",
  "canManageBookings",
  "canManageSupport",
  "canManageContent",
  "canManageFinance",
  "canManagePayments",
  "canAssignWork",
  "canViewAuditLogs",
  "canManageStudio",
  "canWorkStudio",
]);
const passwordSchema = textSchema
  .refine(
    (value) => !value || value.length >= 8,
    "كلمة المرور ٨ أحرف على الأقل",
  )
  .optional();
export const inviteUserSchema = z.object({
  email: emailSchema,
  fullName: requiredTextSchema,
  role: assignableRoleSchema,
  adminRoleId: profileIdSchema.nullable().optional(),
});
export const createUserSchema = inviteUserSchema.extend({
  password: passwordSchema,
});
export const userRoleSchema = z.object({
  userId: profileIdSchema,
  role: assignableRoleSchema,
  adminRoleId: profileIdSchema.nullable().optional(),
});
export const resetUserPasswordSchema = z.object({
  userId: profileIdSchema,
  password: passwordSchema,
});
export const userSuspensionSchema = z
  .object({
    userId: profileIdSchema,
    suspend: z.boolean(),
    reason: textSchema.optional(),
    blockLogin: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.suspend && (value.reason?.length ?? 0) < 3)
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "اكتب سبب الإيقاف، ٣ أحرف على الأقل",
      });
  });
export const deleteUserSchema = z.object({
  userId: profileIdSchema,
  reason: textSchema.min(3, "اكتب سبب الحذف"),
});
export const adminRoleSchema = z.object({
  id: recordIdSchema.optional(),
  name: textSchema
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(z.string().min(2).max(40)),
  permissions: z
    .array(adminPermissionSchema)
    .min(1, "اختر صلاحية واحدة على الأقل"),
});
export const instructorProfileSchema = z.object({
  displayName: requiredTextSchema,
  bio: textSchema,
  specialties: z.array(requiredTextSchema),
  yearsExperience: moneySchema,
});
export const createInstructorSchema = instructorProfileSchema
  .omit({ displayName: true })
  .extend({
    email: emailSchema,
    fullName: requiredTextSchema,
    displayName: textSchema,
    workModel: z.enum(["monthly", "per_session"]),
    password: passwordSchema,
  });
export const instructorStatusSchema = z.object({
  instructorId: recordIdSchema,
  status: z.enum([
    "pending_training",
    "pending_approval",
    "active",
    "hidden",
    "suspended",
  ]),
});
export const instructorPackagesSchema = z.object({
  instructorId: recordIdSchema,
  packageIds: z.array(recordIdSchema),
});
export const instructorCertificationSchema = z.object({
  instructorId: recordIdSchema,
  passed: z.boolean(),
});
export const instructorMediaSchema = z.object({
  imageUrl: optionalCloudinaryUrlSchema.refine(Boolean, "ارفع صورة العمل"),
  title: textSchema.max(120),
  contribution: textSchema.max(80),
});
export const providerSchema = z.object({
  providerId: recordIdSchema,
  displayName: requiredTextSchema,
  bio: textSchema,
  status: z.enum(["pending", "active", "suspended"]),
});
export const createProviderSchema = z.object({
  email: emailSchema,
  displayName: requiredTextSchema,
  bio: textSchema,
});
export const providerOfferingSchema = z
  .object({
    providerId: recordIdSchema,
    serviceId: recordIdSchema,
    approvedPrice: moneySchema.nullable(),
    status: z.enum(["pending", "approved", "rejected"]),
    isActive: z.boolean(),
    adminNotes: textSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === "approved" &&
      !(value.approvedPrice !== null && value.approvedPrice > 0)
    )
      ctx.addIssue({
        code: "custom",
        path: ["approvedPrice"],
        message: "حدد سعرًا أكبر من صفر عند الاعتماد",
      });
  });
export const joinRequestDecisionSchema = z.object({
  requestId: recordIdSchema,
  status: z.enum(["approved", "rejected"]),
});
export const joinRequestMessageSchema = z.object({
  requestId: recordIdSchema,
  message: requiredTextSchema.max(4000),
});
export const transferInstructorWorkSchema = z
  .object({ fromInstructorId: recordIdSchema, toInstructorId: recordIdSchema })
  .refine((value) => value.fromInstructorId !== value.toInstructorId, {
    path: ["toInstructorId"],
    message: "اختر مدربًا آخر",
  });

export const deletionRequestDecisionSchema = z
  .object({
    id: recordIdSchema,
    status: z.enum(["done", "rejected"]),
    adminNotes: textSchema.optional(),
  })
  .refine((value) => value.status !== "rejected" || Boolean(value.adminNotes), {
    path: ["adminNotes"],
    message: "اكتب سبب الرفض",
  });

export const assignAdminRoleSchema = z.object({
  userId: profileIdSchema,
  adminRoleId: profileIdSchema.nullable(),
});
export const instructorTrainingSchema = z.object({
  instructorId: recordIdSchema,
  meetingLink: optionalHttpUrlSchema
    .refine(
      (value) => !value || value.startsWith("https://"),
      "استخدم رابط HTTPS",
    )
    .optional(),
  completedAt: z
    .union([z.literal(""), cairoDateTimeSchema, instantSchema])
    .optional(),
  examScore: textSchema
    .refine(
      (value) =>
        !value ||
        (Number.isFinite(Number(value)) &&
          Number(value) >= 0 &&
          Number(value) <= 100),
      "الدرجة بين صفر و١٠٠",
    )
    .optional(),
});

// Shared by instructor profile requests and portfolio-image moderation.
export const instructorReviewSchema = z
  .object({
    id: recordIdSchema,
    decision: z.enum(["approved", "rejected"]),
    feedback: textSchema,
  })
  .refine(
    (value) => value.decision !== "rejected" || value.feedback.length >= 3,
    { path: ["feedback"], message: "اكتب سبب الرفض، ٣ أحرف على الأقل" },
  );
export const instructorMediaRevocationSchema = z.object({
  id: recordIdSchema,
  feedback: textSchema.min(3, "اكتب سبب سحب الاعتماد"),
});
