import { z } from "zod";
import type { Database } from "@/types/supabase";
import {
  customizationFieldSchema,
  storyGoalSchema,
  writingDialectSchema,
} from "@/lib/schema/catalog-settings";

export const CATALOG_SETTINGS_PROVIDER = "catalogSettings";
export type CustomizationField =
  Database["public"]["Tables"]["customization_fields"]["Row"];
export type StoryGoal = Database["public"]["Tables"]["story_goals"]["Row"];
export type WritingDialect =
  Database["public"]["Tables"]["writing_dialects"]["Row"] & { id: string };
export type PersonalizationRecord = CustomizationField | StoryGoal;
export type PersonalizationKind = "field" | "goal";

const scope = {
  scope: z.enum(["all", "selected"]),
  targets: z.array(z.string().trim().min(1)).max(100, "اختر حتى ١٠٠ عنصر"),
};
const sharedPersonalization = z.object({
  ...scope,
  label: z.string(),
  placeholder: z.string(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

export const personalizationDialogSchema = (kind: PersonalizationKind) =>
  sharedPersonalization.superRefine((value, context) => {
    const checked =
      kind === "field"
        ? customizationFieldSchema.safeParse({ ...value, appliesTo: null })
        : storyGoalSchema.safeParse({ ...value, appliesTo: null });
    if (!checked.success) {
      for (const issue of checked.error.issues) {
        const message = /[\u0600-\u06ff]/.test(issue.message)
          ? issue.message
          : issue.path[0] === "placeholder"
            ? "المثال داخل الخانة بحد أقصى ١٢٠ حرفًا"
            : kind === "field"
              ? "اسم الخانة من حرف واحد إلى ٨٠ حرفًا"
              : "الهدف من حرفين إلى ١٢٠ حرفًا";
        context.addIssue({ ...issue, message });
      }
    }
    if (value.scope === "selected" && value.targets.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "اختر منتجًا واحدًا أو صندوق الرحلة",
      });
    }
  });

export type PersonalizationValues = z.infer<typeof sharedPersonalization>;
export function personalizationValues(
  record?: PersonalizationRecord,
): PersonalizationValues {
  return {
    label: record?.label ?? "",
    placeholder:
      record && "placeholder" in record ? (record.placeholder ?? "") : "",
    isRequired: record && "is_required" in record ? record.is_required : false,
    isActive: record?.is_active ?? true,
    scope: record?.applies_to?.length ? "selected" : "all",
    targets: record?.applies_to ?? [],
  };
}

export function personalizationPayload(
  kind: PersonalizationKind,
  input: PersonalizationValues,
) {
  const values = personalizationDialogSchema(kind).parse(input);
  return {
    label: values.label.trim(),
    is_active: values.isActive,
    applies_to: values.scope === "all" ? null : [...new Set(values.targets)],
    ...(kind === "field"
      ? {
          placeholder: values.placeholder.trim() || null,
          is_required: values.isRequired,
        }
      : {}),
    updated_at: new Date().toISOString(),
  };
}

export const dialectDialogSchema = writingDialectSchema.extend({
  nameAr: z
    .string()
    .trim()
    .min(1, "اكتب اسم اللهجة")
    .max(60, "اسم اللهجة بحد أقصى ٦٠ حرفًا"),
  isActive: z.boolean(),
});
export type DialectValues = z.infer<typeof dialectDialogSchema>;
export function dialectValues(record?: WritingDialect): DialectValues {
  return {
    code: record?.code ?? "",
    nameAr: record?.name_ar ?? "",
    isActive: record?.is_active ?? true,
  };
}
export function dialectPayload(input: DialectValues, creating: boolean) {
  const values = dialectDialogSchema.parse(input);
  return {
    ...(creating ? { code: values.code } : {}),
    name_ar: values.nameAr,
    is_active: values.isActive,
  };
}

export function scopeLabel(targets: string[] | null) {
  if (!targets?.length) return "كل المنتجات وصندوق الرحلة";
  const products = targets.filter((target) => target !== "box").length;
  return [
    products ? `${products.toLocaleString("ar-EG")} من المنتجات` : "",
    targets.includes("box") ? "صندوق الرحلة" : "",
  ]
    .filter(Boolean)
    .join("، ");
}

export function catalogSettingsError(error: unknown): string {
  const value = error as { code?: string; message?: string } | null;
  if (value?.code === "23505")
    return "الكود مستخدم بالفعل. اختر كودًا آخر للهجة.";
  if (value?.code === "42501") return "لا تملك صلاحية حفظ إعدادات الكتالوج.";
  if (error instanceof z.ZodError)
    return error.issues[0]?.message ?? "راجع بيانات النموذج.";
  if (value?.message && /[\u0600-\u06ff]/.test(value.message))
    return value.message;
  return "تعذّر حفظ إعدادات الكتالوج. البيانات محفوظة في النموذج؛ حاول مرة أخرى.";
}
