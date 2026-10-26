import { z } from "zod";
import {
  cairoDateTimeSchema,
  moneySchema,
  optionalCloudinaryUrlSchema,
  optionalHttpUrlSchema,
  recordIdSchema,
  requiredTextSchema,
  sortOrderSchema,
  textSchema,
} from "./common";

// Sources: actions/writing, box-plans, standalone-services, admin-sessions, bookings;
// lib/service-details and private-files. These are normalized command values, not FormData.
export const writingPackageSchema = z.object({
  id: recordIdSchema.optional(),
  name: requiredTextSchema,
  ageGroup: z.enum(["under_12", "12_plus"]),
  track: textSchema.nullable().optional(),
  price: moneySchema,
  sessionsCount: z.number().finite().int().positive(),
  durationText: textSchema.optional(),
  sessionDuration: textSchema.optional(),
  targetAudience: textSchema.optional(),
  prerequisiteNote: textSchema.optional(),
  prerequisitePackageId: textSchema.optional(),
  shortDescription: textSchema.optional(),
  fullDescription: textSchema.optional(),
  isActive: z.boolean(),
  slug: textSchema.optional(),
});
export const boxPlanSchema = z
  .object({
    name: requiredTextSchema,
    priceTotal: moneySchema,
    priceMonthly: moneySchema,
    durationMonths: z.number().finite().int().min(1),
    savingsNote: textSchema,
    description: textSchema,
    imageUrl: textSchema,
    features: z.array(textSchema),
    isHighlighted: z.boolean(),
    isActive: z.boolean(),
    sortOrder: sortOrderSchema,
    addonDiscountPercent: z.number().finite().int().min(0).max(90),
    freeAddonId: textSchema,
  })
  .refine(
    (value) =>
      value.priceMonthly * value.durationMonths >= value.priceTotal - 0.01,
    { path: ["priceTotal"], message: "الإجمالي أكبر من السعر الشهري × المدة" },
  );
export const creativeServiceSchema = z.object({
  name: requiredTextSchema,
  price: moneySchema,
  description: textSchema.max(300),
  category: textSchema,
  priceType: z.enum(["fixed", "starts_from"]),
  sortOrder: sortOrderSchema.nullable(),
  coverImageUrl: optionalCloudinaryUrlSchema.optional(),
  galleryImageUrls: z
    .array(optionalCloudinaryUrlSchema)
    .transform((values) => [...new Set(values.filter(Boolean))])
    .pipe(z.array(optionalCloudinaryUrlSchema).max(8))
    .optional(),
  longDescription: textSchema.max(5000).optional(),
  deliverablesText: textSchema
    .refine((value) => {
      const lines = [
        ...new Set(
          value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        ),
      ];
      return lines.length <= 8 && lines.every((line) => line.length <= 120);
    }, "٨ نقاط كحد أقصى، وكل نقطة حتى ١٢٠ حرفًا")
    .optional(),
  requirements: textSchema.max(1500).optional(),
  deliveryDays: z.number().finite().int().min(0).max(90).nullable().optional(),
  allowsFiles: z.boolean().optional(),
  fileMaxMb: z.number().finite().min(1).max(10).optional(),
  fileKinds: z.array(z.enum(["pdf", "word", "image"])).optional(),
});
export const assignBookingInstructorSchema = z.object({
  subscriptionId: recordIdSchema,
  instructorId: recordIdSchema,
});
export const cancelBookingSchema = z.object({
  subscriptionId: recordIdSchema,
  reason: textSchema.optional(),
});
export const createSessionSchema = z.object({
  subscriptionId: recordIdSchema,
  scheduledAt: cairoDateTimeSchema,
  instructorId: recordIdSchema.nullable(),
  reason: textSchema,
});
export const sessionDetailsSchema = z.object({
  sessionId: recordIdSchema,
  meetingUrl: optionalHttpUrlSchema,
  scheduledAt: cairoDateTimeSchema,
});
export const sessionChangeDecisionSchema = z
  .object({
    id: recordIdSchema,
    decision: z.enum(["approved", "rejected"]),
    note: textSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "rejected" && (value.note?.length ?? 0) < 3)
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "اكتب سبب الرفض، ٣ أحرف على الأقل",
      });
  });
