import { z } from "zod";
import type { Database } from "@/types/supabase";
import { writingPackageSchema } from "@/lib/schema";

export const WRITING_PACKAGES_RESOURCE = "creative_writing_packages";

export type WritingPackage =
  Database["public"]["Tables"]["creative_writing_packages"]["Row"];

const numericText = (message: string, validate: (value: number) => boolean) =>
  z.string().trim().refine(
    (input) => input !== "" && Number.isFinite(Number(input)) && validate(Number(input)),
    message,
  );

const requiredText = (message: string) =>
  z.string().trim().min(1, message);

const dialogFieldsSchema = z.object({
  name: requiredText("اكتب اسم الباقة"),
  ageGroup: z.enum(["under_12", "12_plus"]),
  track: z.enum(["", "foundation", "youth", "specialization"]),
  price: numericText("اكتب السعر بشكل صحيح", (value) => value >= 0),
  sessionsCount: numericText(
    "عدد الجلسات لازم يكون رقمًا صحيحًا أكبر من صفر",
    (value) => Number.isInteger(value) && value > 0,
  ),
  durationText: requiredText("اكتب مدة البرنامج"),
  sessionDuration: requiredText("اكتب مدة الجلسة"),
  targetAudience: requiredText("اكتب الفئة المستهدفة"),
  prerequisiteNote: z.string(),
  prerequisitePackageId: z.string(),
  shortDescription: requiredText("اكتب الوصف القصير"),
  fullDescription: requiredText("اكتب الوصف الكامل"),
  isActive: z.boolean(),
});

export const writingPackageDialogSchema = dialogFieldsSchema.superRefine(
  (input, context) => {
    const result = writingPackageSchema.safeParse({
      name: input.name,
      ageGroup: input.ageGroup,
      track: input.track || null,
      price: Number(input.price),
      sessionsCount: Number(input.sessionsCount),
      durationText: input.durationText,
      sessionDuration: input.sessionDuration,
      targetAudience: input.targetAudience,
      prerequisiteNote: input.prerequisiteNote,
      prerequisitePackageId: input.prerequisitePackageId,
      shortDescription: input.shortDescription,
      fullDescription: input.fullDescription,
      isActive: input.isActive,
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
  },
);

export type WritingPackageDialogValues = z.input<typeof writingPackageDialogSchema>;

export function defaultWritingPackageValues(): WritingPackageDialogValues {
  return {
    name: "",
    ageGroup: "under_12",
    track: "",
    price: "",
    sessionsCount: "",
    durationText: "",
    sessionDuration: "",
    targetAudience: "",
    prerequisiteNote: "",
    prerequisitePackageId: "",
    shortDescription: "",
    fullDescription: "",
    isActive: true,
  };
}

export function writingPackageValues(row?: WritingPackage): WritingPackageDialogValues {
  if (!row) return defaultWritingPackageValues();
  return {
    name: row.name,
    ageGroup: row.age_group,
    track: row.track ?? "",
    price: String(row.price),
    sessionsCount: String(row.sessions_count ?? ""),
    durationText: row.duration_text ?? "",
    sessionDuration: row.session_duration ?? "",
    targetAudience: row.target_audience ?? "",
    prerequisiteNote: row.prerequisite_note ?? "",
    prerequisitePackageId: row.prerequisite_package_id ?? "",
    shortDescription: row.short_description ?? "",
    fullDescription: row.full_description ?? "",
    isActive: row.is_active,
  };
}

function writingPackageDatabaseValues(input: WritingPackageDialogValues) {
  const form = writingPackageDialogSchema.parse(input);
  const value = writingPackageSchema.parse({
    name: form.name,
    ageGroup: form.ageGroup,
    track: form.track || null,
    price: Number(form.price),
    sessionsCount: Number(form.sessionsCount),
    durationText: form.durationText,
    sessionDuration: form.sessionDuration,
    targetAudience: form.targetAudience,
    prerequisiteNote: form.prerequisiteNote,
    prerequisitePackageId: form.prerequisitePackageId,
    shortDescription: form.shortDescription,
    fullDescription: form.fullDescription,
    isActive: form.isActive,
  });

  return {
    name: value.name,
    age_group: value.ageGroup,
    track: value.track || null,
    price: value.price,
    sessions_count: value.sessionsCount,
    duration_text: value.durationText || null,
    session_duration: value.sessionDuration || null,
    target_audience: value.targetAudience || null,
    prerequisite_note: value.prerequisiteNote || null,
    prerequisite_package_id: value.prerequisitePackageId || null,
    short_description: value.shortDescription || null,
    full_description: value.fullDescription || null,
    is_active: value.isActive,
    updated_at: new Date().toISOString(),
  };
}

function newPackageSlug(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "writing-package";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function writingPackageCreate(input: WritingPackageDialogValues) {
  return {
    ...writingPackageDatabaseValues(input),
    slug: newPackageSlug(input.name),
  } satisfies Database["public"]["Tables"]["creative_writing_packages"]["Insert"];
}

export function writingPackageUpdate(input: WritingPackageDialogValues) {
  // Keep the existing slug stable so previously shared package URLs continue to work.
  return writingPackageDatabaseValues(input) satisfies Database["public"]["Tables"]["creative_writing_packages"]["Update"];
}

export function writingPackageError(error: unknown): string {
  const value = error as { code?: string; statusCode?: number; status?: number } | null;
  if (value?.code === "23505")
    return "تعذّر إنشاء رابط فريد للباقة. حاول الحفظ مرة أخرى.";
  if (value?.code === "23503")
    return "لا يمكن حفظ الباقة بسبب اشتراك أو متطلب مرتبط بها.";
  if (value?.code === "42501" || [401, 403].includes(value?.statusCode ?? value?.status ?? 0))
    return "ليس لديك صلاحية لحفظ باقات الكتابة الإبداعية.";
  return "تعذّر حفظ الباقة. بياناتك ما زالت في النموذج؛ حاول مرة أخرى.";
}
