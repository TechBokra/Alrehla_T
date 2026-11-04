import { z } from "zod";
import type { Database } from "@/types/supabase";
import { boxPlanSchema } from "@/lib/schema";

export const BOX_PLANS_RESOURCE = "box_subscription_plans";
export const BOX_PLANS_PROVIDER = "boxPlans";

export type BoxPlan =
  Database["public"]["Tables"]["box_subscription_plans"]["Row"];
export type BoxPlanAddon = Pick<
  Database["public"]["Tables"]["addon_products"]["Row"],
  "id" | "name" | "is_active"
>;

const imageSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), url: z.string().trim().min(1) }),
  z.object({
    kind: z.literal("queued"),
    uploadId: z.string().trim().min(1),
    name: z.string(),
  }),
]);

const numericText = (message: string, validate: (value: number) => boolean) =>
  z.string().trim().refine(
    (input) => input !== "" && Number.isFinite(Number(input)) && validate(Number(input)),
    message,
  );

export const boxPlanDialogSchema = z
  .object({
    name: z.string().trim().min(1, "اكتب اسم الباقة"),
    priceTotal: numericText("اكتب السعر الإجمالي بشكل صحيح", (value) => value >= 0),
    priceMonthly: numericText("اكتب السعر الشهري بشكل صحيح", (value) => value >= 0),
    durationMonths: numericText(
      "المدة لا تقل عن شهر",
      (value) => Number.isInteger(value) && value >= 1,
    ),
    savingsNote: z.string().trim(),
    description: z.string().trim(),
    image: z.array(imageSelectionSchema).max(1, "اختر صورة واحدة فقط"),
    featuresText: z.string(),
    isHighlighted: z.boolean(),
    isActive: z.boolean(),
    sortOrder: numericText(
      "ترتيب العرض يجب أن يكون عددًا صحيحًا",
      (value) => Number.isInteger(value),
    ),
    addonDiscountPercent: numericText(
      "خصم الإضافات من ٠ لـ٩٠٪",
      (value) => Number.isInteger(value) && value >= 0 && value <= 90,
    ),
    freeAddonId: z.string().trim(),
  })
  .superRefine((input, context) => {
    const selected = input.image[0];
    const result = boxPlanSchema.safeParse({
      name: input.name,
      priceTotal: Number(input.priceTotal),
      priceMonthly: Number(input.priceMonthly),
      durationMonths: Number(input.durationMonths),
      savingsNote: input.savingsNote,
      description: input.description,
      imageUrl: selected?.kind === "saved" ? selected.url : "",
      features: input.featuresText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      isHighlighted: input.isHighlighted,
      isActive: input.isActive,
      sortOrder: Number(input.sortOrder),
      addonDiscountPercent: Number(input.addonDiscountPercent),
      freeAddonId: input.freeAddonId,
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });

export type BoxPlanDialogValues = z.input<typeof boxPlanDialogSchema>;

export function defaultBoxPlanValues(): BoxPlanDialogValues {
  return {
    name: "",
    priceTotal: "0",
    priceMonthly: "0",
    durationMonths: "1",
    savingsNote: "",
    description: "",
    image: [],
    featuresText: "",
    isHighlighted: false,
    isActive: true,
    sortOrder: "0",
    addonDiscountPercent: "0",
    freeAddonId: "",
  };
}

export function boxPlanValues(row?: BoxPlan): BoxPlanDialogValues {
  if (!row) return defaultBoxPlanValues();
  return {
    name: row.name,
    priceTotal: String(row.price_total),
    priceMonthly: String(row.price_monthly),
    durationMonths: String(row.duration_months),
    savingsNote: row.savings_note ?? "",
    description: row.description ?? "",
    image: row.image_url ? [{ kind: "saved", url: row.image_url }] : [],
    featuresText: (row.features ?? []).join("\n"),
    isHighlighted: row.is_highlighted,
    isActive: row.is_active,
    sortOrder: String(row.sort_order),
    addonDiscountPercent: String(row.addon_discount_percent ?? 0),
    freeAddonId: row.free_addon_id ?? "",
  };
}

export function boxPlanPayload(input: BoxPlanDialogValues, imageUrl: string) {
  const form = boxPlanDialogSchema.parse(input);
  return boxPlanSchema.parse({
    name: form.name,
    priceTotal: Number(form.priceTotal),
    priceMonthly: Number(form.priceMonthly),
    durationMonths: Number(form.durationMonths),
    savingsNote: form.savingsNote,
    description: form.description,
    imageUrl,
    features: form.featuresText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    isHighlighted: form.isHighlighted,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder),
    addonDiscountPercent: Number(form.addonDiscountPercent),
    freeAddonId: form.freeAddonId,
  });
}

export function boxPlanError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.find((issue) => /[\u0600-\u06ff]/.test(issue.message))
      ?.message ?? "راجع بيانات الباقة قبل الحفظ.";
  }
  const value = error as { code?: string; message?: string } | null;
  if (value?.code === "23505")
    return "فيه باقة أخرى محددة على أنها الأكثر اختيارًا.";
  if (value?.code === "23503")
    return "لا يمكن حذف الخطة لوجود اشتراك مرتبط بها.";
  if (value?.code === "42501") return "ليس لديك صلاحية لحفظ هذه الخطة.";
  if (value?.message && /[\u0600-\u06ff]/.test(value.message))
    return value.message;
  return "تعذّر حفظ خطة صندوق الرحلة. بياناتك ما زالت في النموذج؛ حاول مرة أخرى.";
}
