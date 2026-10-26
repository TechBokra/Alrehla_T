import { z } from "zod";
import { moneySchema, optionalHttpUrlSchema, textSchema } from "./common";

// Source: actions/content.ts and lib/watermark-settings.ts.
// Partial updates preserve omitted fields; defaults belong to feature models.
export const watermarkSchema = z.object({
  enabled: z.boolean(),
  text: textSchema.max(40),
  style: z.enum(["light", "dark"]),
  size: z.enum(["small", "medium", "large"]),
  position: z.enum(["bottom", "center"]),
  look: z.enum(["plain", "badge"]),
  opacity: z.enum(["soft", "medium", "strong"]),
});
export const siteSettingsSchema = z.object({
  siteName: textSchema.optional(),
  contactEmail: textSchema.optional(),
  contactPhone: textSchema.optional(),
  whatsappNumber: textSchema.optional(),
  address: textSchema.optional(),
  workingHours: textSchema.optional(),
  facebookUrl: optionalHttpUrlSchema.optional(),
  instagramUrl: optionalHttpUrlSchema.optional(),
  instructorPriceAlert: moneySchema.nullable().optional(),
  pendingOrderCancelDays: z.number().int().min(0).max(60).optional(),
  sessionRecording: z
    .object({
      enabled: z.boolean(),
      retentionDays: z.number().int().min(1).max(365),
    })
    .optional(),
  watermark: watermarkSchema.optional(),
  mediaCleanup: z
    .object({ enabled: z.boolean(), days: z.number().int().min(7).max(365) })
    .optional(),
  childPhotoRetentionDays: z.number().int().min(7).max(365).optional(),
  fileRetentionDays: z.number().int().min(7).max(365).optional(),
  announcement: z
    .object({ enabled: z.boolean(), text: textSchema, until: textSchema })
    .refine((value) => !value.enabled || Boolean(value.text), {
      path: ["text"],
      message: "اكتب نص التنبيه",
    })
    .optional(),
});

// Transfer settings only; no provider checkout or secret configuration.
export const transferDetailsSchema = z.object({
  walletNumber: textSchema.regex(/^[0-9+\s-]{8,20}$/, "رقم المحفظة غير صحيح"),
  qrUrl: optionalHttpUrlSchema.nullable(),
});
