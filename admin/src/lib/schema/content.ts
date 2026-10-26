import { z } from "zod";
import {
  cairoDateTimeSchema,
  instantSchema,
  optionalHttpUrlSchema,
  requiredTextSchema,
  sortOrderSchema,
  textSchema,
} from "./common";

// Sources: actions/blog, content, notifications-admin; lib/ads.
export const blogPostSchema = z
  .object({
    title: requiredTextSchema,
    slug: textSchema,
    excerpt: textSchema,
    seoDescription: textSchema,
    content: requiredTextSchema,
    coverImageUrl: optionalHttpUrlSchema,
    authorName: textSchema,
    publishMode: z.enum(["published", "scheduled", "draft"]),
    scheduledAt: z.union([z.literal(""), cairoDateTimeSchema]),
  })
  .refine(
    (value) => value.publishMode !== "scheduled" || Boolean(value.scheduledAt),
    { path: ["scheduledAt"], message: "حدد موعد النشر" },
  );
export const testimonialSchema = z.object({
  authorName: requiredTextSchema,
  authorRole: textSchema,
  content: requiredTextSchema,
  line: z.enum(["enha_lak", "creative_writing", "general"]).optional(),
});
const adPlacementSchema = z
  .string()
  .refine(
    (value) =>
      /^(home|enha-lak|library|creative-writing|packages|services|aqlam|blog|about|support):(top|bottom)$/.test(
        value,
      ),
    "موضع الإعلان غير صالح",
  );
export const internalOrHttpsLinkSchema = textSchema.refine((value) => {
  if (!value) return true;
  // Backslashes can turn a relative URL into an external host in browsers.
  if (value.startsWith("/") && !value.startsWith("//") && !/[\\\s]/.test(value))
    return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "استخدم مسارًا داخليًا أو رابط HTTPS");
const optionalInstant = z.union([z.literal(""), instantSchema]).nullable();
export const adSchema = z
  .object({
    title: requiredTextSchema.max(120),
    advertiserName: textSchema.max(80).nullable(),
    imageUrl: requiredTextSchema,
    imageUrlMobile: textSchema.nullable(),
    linkUrl: internalOrHttpsLinkSchema.nullable(),
    placements: z.array(adPlacementSchema).min(1, "اختر موضعًا للإعلان"),
    startsAt: optionalInstant,
    endsAt: optionalInstant,
    isActive: z.boolean(),
    sortOrder: sortOrderSchema,
  })
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      Date.parse(value.endsAt) > Date.parse(value.startsAt),
    { path: ["endsAt"], message: "النهاية بعد البداية" },
  );
export const pageContentEntrySchema = z.object({
  key: requiredTextSchema,
  value: textSchema,
});
export const pageContentSchema = z.array(pageContentEntrySchema); // Server checks known editable content keys.
export const siteImageSchema = z.object({
  key: requiredTextSchema,
  url: optionalHttpUrlSchema,
});
export const broadcastNotificationSchema = z.object({
  title: requiredTextSchema,
  message: textSchema.optional(),
  link: internalOrHttpsLinkSchema.optional(),
  target: requiredTextSchema,
});
export const disabledNotificationsSchema = z.object({
  types: z.array(requiredTextSchema),
}); // Server owns supported notification types.

export const mediaDeletionSchema = z.object({
  publicIds: z.array(requiredTextSchema).min(1).max(50),
  acknowledgeHighRatio: z.boolean().optional(),
}); // Server verifies project folder and references before deletion.
