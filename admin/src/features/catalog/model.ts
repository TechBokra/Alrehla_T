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
export const catalogSchema = catalogFields.superRefine((value, context) => {
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
export function defaultCatalogValues(): CatalogValues {
  return {
    name: "",
    description: "",
    longDescription: "",
    price: "",
    electronicPrice: "",
    imageUrl: "",
    category: "library",
    isActive: false,
    sortOrder: "0",
  };
}
export const addonSchema = catalogFields.extend({
  price: priceText(true),
  imageUrl: imageUrl.refine(
    (value) => !value || value.startsWith("https://res.cloudinary.com/"),
    "صورة الإضافة يجب أن تكون رابط Cloudinary",
  ),
});
export function productSlug(
  name: string,
  suffix = crypto.randomUUID().slice(0, 8),
) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "product";
  return `${base}-${suffix}`;
}
export function catalogError(error: unknown): string {
  const value = error as {
    code?: string;
    statusCode?: number;
    status?: number;
  } | null;
  if (value?.code === "23505")
    return "رابط المنتج مستخدم بالفعل. حاول الإنشاء مرة أخرى.";
  if (
    value?.code === "42501" ||
    [401, 403].includes(value?.statusCode ?? value?.status ?? 0)
  )
    return "ليس لديك صلاحية لحفظ هذا السجل.";
  if (value?.code === "23514")
    return "تعذّر الحفظ لأن البيانات لا تطابق قواعد المنتج.";
  return "تعذّر حفظ البيانات. القيم محفوظة في النموذج؛ حاول مرة أخرى.";
}
