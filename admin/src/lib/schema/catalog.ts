import { z } from "zod";

const priceText = (allowZero = false) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        value !== "" &&
        Number.isFinite(Number(value)) &&
        (allowZero ? Number(value) >= 0 : Number(value) > 0) &&
        Number(value) <= 1_000_000,
      "اكتب سعرًا صحيحًا في الحدود المسموحة",
    );

const imageUrl = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "اكتب رابط صورة HTTP أو HTTPS صالحًا");

const catalogFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "الاسم يجب أن يحتوي على حرفين على الأقل")
    .max(120, "الاسم بحد أقصى ١٢٠ حرفًا"),
  description: z.string().trim().max(600, "الوصف المختصر بحد أقصى ٦٠٠ حرف"),
  longDescription: z
    .string()
    .trim()
    .max(5000, "الوصف الكامل بحد أقصى ٥٠٠٠ حرف"),
  price: priceText(),
  electronicPrice: z.string().trim(),
  imageUrl,
  category: z.enum(["library", "custom"]),
  isActive: z.boolean(),
  sortOrder: z
    .string()
    .trim()
    .refine(
      (value) =>
        value !== "" &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) >= -2147483648 &&
        Number(value) <= 2147483647,
      "الترتيب يجب أن يكون عددًا صحيحًا",
    ),
});
export type CatalogValues = z.infer<typeof catalogFields>;
export const productSchema = catalogFields.superRefine((value, context) => {
  if (
    value.category === "custom" &&
    value.electronicPrice &&
    !priceText().safeParse(value.electronicPrice).success
  ) {
    context.addIssue({
      code: "custom",
      path: ["electronicPrice"],
      message: "السعر الإلكتروني غير صحيح",
    });
  }
});
export const addonSchema = catalogFields.extend({
  price: priceText(true),
  imageUrl: imageUrl.refine(
    (value) => !value || value.startsWith("https://res.cloudinary.com/"),
    "صورة الإضافة يجب أن تكون رابط Cloudinary",
  ),
});

export type ProductFormInput = z.input<typeof productSchema>;
export type ProductFormValues = z.output<typeof productSchema>;
export type AddonFormInput = z.input<typeof addonSchema>;
export type AddonFormValues = z.output<typeof addonSchema>;
