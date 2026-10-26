import { z } from "zod";
import {
  cairoDateTimeSchema,
  dateOnlySchema,
  recordIdSchema,
  requiredTextSchema,
  textSchema,
} from "./common";

// Sources: lib/customization-fields, story-goals, writing-style, promotions, discount-codes.
const appliesToSchema = z.array(recordIdSchema).nullable(); // IDs or reserved "box"; existence checked server-side.
export const customizationFieldSchema = z.object({
  id: recordIdSchema.optional(),
  label: requiredTextSchema.max(80),
  placeholder: textSchema.max(120).optional(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  appliesTo: appliesToSchema.optional(),
});
export const storyGoalSchema = z.object({
  id: recordIdSchema.optional(),
  label: textSchema
    .min(2)
    .max(120)
    .refine((value) => value.toLowerCase() !== "other", "هذه الكلمة محجوزة"),
  isActive: z.boolean(),
  appliesTo: appliesToSchema,
});
export const writingDialectSchema = z.object({
  code: textSchema.regex(
    /^[a-z_]{2,20}$/,
    "الكود حروف إنجليزية صغيرة وشرطة سفلية، من ٢ إلى ٢٠ حرفًا",
  ),
  nameAr: requiredTextSchema.max(60),
  isActive: z.boolean().optional(),
});
export const promotionSchema = z
  .object({
    targetType: z.enum([
      "product_printed",
      "product_electronic",
      "addon",
      "box_plan",
    ]),
    targetId: recordIdSchema,
    kind: z.enum(["percent", "sale_price"]),
    value: z.number().finite().int().positive(),
    label: textSchema.max(60).optional(),
    startsAtLocal: cairoDateTimeSchema,
    endsAtLocal: cairoDateTimeSchema,
  })
  .superRefine((value, ctx) => {
    if (value.kind === "percent" && value.value >= 100)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "الخصم أقل من ١٠٠٪",
      });
    if (value.endsAtLocal <= value.startsAtLocal)
      ctx.addIssue({
        code: "custom",
        path: ["endsAtLocal"],
        message: "النهاية بعد البداية",
      });
  });
export const discountCodeSchema = z
  .object({
    id: recordIdSchema.optional(),
    code: textSchema
      .toUpperCase()
      .regex(
        /^[A-Z0-9_-]{3,30}$/,
        "الكود من ٣ إلى ٣٠ حرفًا إنجليزيًا أو رقمًا أو - أو _",
      ),
    percent: z.number().finite().int().min(1).max(90),
    lines: z.array(z.enum(["enha_lak", "box", "courses", "services"])),
    startsOn: z.union([z.literal(""), dateOnlySchema]),
    endsOn: z.union([z.literal(""), dateOnlySchema]),
    maxUses: textSchema.refine(
      (value) =>
        !value ||
        (/^\d+$/.test(value) &&
          Number.isSafeInteger(Number(value)) &&
          Number(value) >= 1),
      "عدد الاستخدامات عدد صحيح موجب",
    ),
    note: textSchema.max(300),
    isActive: z.boolean(),
  })
  .refine(
    (value) =>
      !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn,
    { path: ["endsOn"], message: "تاريخ النهاية لا يسبق البداية" },
  );
export const reorderIdsSchema = z.object({
  ids: z
    .array(recordIdSchema)
    .refine((ids) => new Set(ids).size === ids.length, "المعرّفات مكررة"),
});

export const productReviewSchema = z
  .object({
    id: recordIdSchema,
    decision: z.enum(["approved", "rejected"]),
    note: textSchema,
  })
  .refine((value) => value.decision !== "rejected" || value.note.length >= 3, {
    path: ["note"],
    message: "اكتب سبب الرفض، ٣ أحرف على الأقل",
  });

// actions/product-order.ts: hero ordering accepts 1–500 selected product IDs.
export const heroProductOrderSchema = z.object({
  ids: z
    .array(recordIdSchema)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, "المعرّفات مكررة"),
});
