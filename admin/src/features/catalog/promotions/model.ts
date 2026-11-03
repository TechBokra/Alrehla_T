import { z } from "zod";
import type { Database } from "@/types/supabase";
import { promotionSchema } from "@/lib/schema";

export type Promotion =
  Database["public"]["Tables"]["price_promotions"]["Row"] & {
    target_name?: string | null;
  };
export const PROMOTIONS_PROVIDER = "promotions";
export const targetLabels = {
  product_printed: "قصة — النسخة المطبوعة",
  product_electronic: "قصة — النسخة الإلكترونية",
  addon: "إضافة",
  box_plan: "خطة صندوق الرحلة",
} as const;
export type TargetType = keyof typeof targetLabels;
export const promotionDialogSchema = z
  .object({
    targetType: z.enum([
      "product_printed",
      "product_electronic",
      "addon",
      "box_plan",
    ]),
    targetId: z.string().trim().min(1, "اختر العنصر"),
    kind: z.enum(["percent", "sale_price"]),
    value: z.string().trim().min(1, "اكتب قيمة الخصم"),
    label: z.string().trim().max(60),
    startsAtLocal: z.string(),
    endsAtLocal: z.string(),
  })
  .superRefine((input, ctx) => {
    const parsed = promotionSchema.safeParse({
      ...input,
      value: Number(input.value),
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues) ctx.addIssue(issue);
    for (const name of ["startsAtLocal", "endsAtLocal"] as const) {
      if (!cairoLocalToIso(input[name]))
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: "الوقت غير صالح بتوقيت القاهرة",
        });
    }
  });

function cairoOffset(at: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (key: string) =>
    Number(parts.find((part) => part.type === key)?.value);
  return (
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    ) -
    Math.floor(at / 1000) * 1000
  );
}
export function isoToCairoLocal(iso: string) {
  const instant = Date.parse(iso);
  return Number.isFinite(instant)
    ? new Date(instant + cairoOffset(instant)).toISOString().slice(0, 16)
    : "";
}
export function cairoLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  if (!Number.isFinite(guess)) return null;
  let instant = guess - cairoOffset(guess);
  instant = guess - cairoOffset(instant);
  const iso = new Date(instant).toISOString();
  // Reject normalized calendar dates and nonexistent Cairo clock times.
  return isoToCairoLocal(iso) === local ? iso : null;
}
export function promotionValues(row?: Promotion) {
  return {
    targetType: (row?.target_type ?? "product_printed") as TargetType,
    targetId: row?.target_id ?? "",
    kind: (row?.kind ?? "percent") as "percent" | "sale_price",
    value: row ? String(row.value) : "",
    label: row?.label ?? "",
    startsAtLocal: row ? isoToCairoLocal(row.starts_at) : "",
    endsAtLocal: row ? isoToCairoLocal(row.ends_at) : "",
  };
}
export function promotionPayload(input: z.input<typeof promotionDialogSchema>) {
  const value = promotionDialogSchema.parse(input);
  return {
    target_type: value.targetType,
    target_id: value.targetId,
    kind: value.kind,
    value: Number(value.value),
    label: value.label || null,
    starts_at: cairoLocalToIso(value.startsAtLocal)!,
    ends_at: cairoLocalToIso(value.endsAtLocal)!,
  };
}
export function promotionState(row: Promotion, now: number) {
  if (!row.is_active) return "موقوف";
  if (now < Date.parse(row.starts_at)) return "قادم";
  return now >= Date.parse(row.ends_at) ? "منتهي" : "ساري الآن";
}
export function promotionError(error: unknown) {
  if (error instanceof z.ZodError)
    return (
      error.issues.find((issue) => /[\u0600-\u06ff]/.test(issue.message))
        ?.message ?? "راجع بيانات العرض والتواريخ قبل الحفظ."
    );
  if (error instanceof Error && /[\u0600-\u06ff]/.test(error.message))
    return error.message;
  return "تعذّر حفظ العرض. اختياراتك محفوظة؛ أعد المحاولة.";
}
