import { z } from "zod";

export const productImageSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), url: z.string().url() }),
  z.object({ kind: z.literal("queued"), uploadId: z.string().min(1), name: z.string() }),
]);

const optionalAge = z.string().trim().refine(
  (value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 0 && Number(value) <= 20),
  "العمر يجب أن يكون رقمًا من ٠ إلى ٢٠",
);

export const productPageSchema = z.object({
  name: z.string().trim().min(2, "الاسم يجب أن يحتوي على حرفين على الأقل").max(120, "الاسم بحد أقصى ١٢٠ حرفًا"),
  category: z.enum(["library", "custom"]),
  description: z.string().trim().max(600, "الوصف المختصر بحد أقصى ٦٠٠ حرف"),
  price: z.string().trim().refine((value) => {
    const amount = Number(value);
    return value !== "" && Number.isFinite(amount) && amount > 0 && amount <= 1_000_000;
  }, "اكتب سعرًا صحيحًا أكبر من صفر"),
  electronicPrice: z.string().trim(),
  writingStyles: z.array(z.enum(["fusha", "simple", "dialect"])).max(3),
  minAge: optionalAge,
  maxAge: optionalAge,
  longDescription: z.string().trim().max(5000, "الوصف الكامل بحد أقصى ٥٠٠٠ حرف"),
  featuresText: z.string().max(5000, "الميزات بحد أقصى ٥٠٠٠ حرف"),
  images: z.array(productImageSelectionSchema).max(1, "يمكن اختيار غلاف واحد فقط"),
  isActive: z.boolean(),
}).superRefine((value, context) => {
  if (value.category === "custom") {
    if (value.electronicPrice) {
      const electronic = Number(value.electronicPrice);
      if (!Number.isFinite(electronic) || electronic <= 0 || electronic > 1_000_000) {
        context.addIssue({ code: "custom", path: ["electronicPrice"], message: "السعر الإلكتروني غير صحيح" });
      }
    }
    if (value.writingStyles.length === 0) {
      context.addIssue({ code: "custom", path: ["writingStyles"], message: "اختر أسلوب كتابة واحدًا على الأقل" });
    }
  }
  if (value.minAge && value.maxAge && Number(value.minAge) > Number(value.maxAge)) {
    context.addIssue({ code: "custom", path: ["maxAge"], message: "الحد الأقصى للعمر يجب ألا يقل عن الحد الأدنى" });
  }
  if (value.maxAge && !value.minAge) {
    context.addIssue({ code: "custom", path: ["minAge"], message: "حدد العمر الأدنى قبل إدخال العمر الأقصى" });
  }
});

export const preparationDaysSchema = z.object({
  electronic: z.string().trim().refine(
    (value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 120),
    "المدة من يوم إلى ١٢٠ يومًا أو اتركها فارغة",
  ),
  printed: z.string().trim().refine(
    (value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 120),
    "المدة من يوم إلى ١٢٠ يومًا أو اتركها فارغة",
  ),
});

export type ProductImageSelection = z.infer<typeof productImageSelectionSchema>;
export type ProductPageValues = z.infer<typeof productPageSchema>;
export type PreparationDaysValues = z.infer<typeof preparationDaysSchema>;
