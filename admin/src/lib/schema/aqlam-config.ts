import { z } from "zod";
import { textSchema } from "./common";

// Source: client/src/lib/aqlam/config.ts, AQLAM_SECTIONS + list parsers.
const sortSchema = z.enum(["new", "top", "old"]);
const categorySchema = z.object({
  key: textSchema.toLowerCase().regex(/^[a-z][a-z0-9_]{1,23}$/),
  label: textSchema.min(1).max(30),
  icon: z.enum([
    "book",
    "feather",
    "lightbulb",
    "newspaper",
    "clapperboard",
    "pen",
    "quote",
    "sparkles",
    "heart",
    "star",
    "globe",
    "music",
  ]),
  enabled: z.boolean(),
});
const reactionSchema = z.object({
  key: z.enum(["heart", "star", "spark"]),
  label: textSchema.min(1).max(20),
  emoji: textSchema
    .min(1)
    .refine((value) => [...value].length <= 8, "حتى ٨ رموز"),
  enabled: z.boolean(),
});
const reportReasonSchema = z.object({
  key: z.enum(["contact_info", "inappropriate", "bullying", "copied", "other"]),
  label: textSchema.min(1).max(40),
  enabled: z.boolean(),
});
export const aqlamConfigSchema = z
  .object({
    limits: z.object({
      postsPerDay: z.number().int().min(1).max(50),
      editsPerDay: z.number().int().min(1).max(100),
      commentsPerDay: z.number().int().min(1).max(500),
      reactionsPerDay: z.number().int().min(10).max(5000),
      reportsPerDay: z.number().int().min(1).max(200),
      guardianRequestsPerDay: z.number().int().min(1).max(20),
      titleMax: z.number().int().min(20).max(300),
      bodyMin: z.number().int().min(1).max(2000),
      bodyMax: z.number().int().min(200).max(100000),
      commentMax: z.number().int().min(20).max(2000),
      bioMax: z.number().int().min(50).max(1000),
      penNameMin: z.number().int().min(2).max(10),
      penNameMax: z.number().int().min(10).max(60),
      reportDetailsMax: z.number().int().min(50).max(2000),
      guardianReasonMin: z.number().int().min(3).max(100),
      guardianReasonMax: z.number().int().min(50).max(1000),
    }),
    moderation: z.object({
      reviewFirstN: z.number().int().min(1).max(20),
      reportsToAutoHide: z.number().int().min(0).max(50),
      removedRetentionDays: z.number().int().min(1).max(365),
      maxPinned: z.number().int().min(1).max(12),
      review12Plus: z.enum(["off", "first", "all"]),
      reReviewEdits: z.boolean(),
      blockedWordsAction: z.enum(["reject", "review"]),
    }),
    filters: z.object({
      pageSize: z.number().int().min(6).max(48),
      showCategory: z.boolean(),
      showAge: z.boolean(),
      showSort: z.boolean(),
      defaultSort: sortSchema,
      sorts: z.array(sortSchema).min(1),
      ageBands: z.array(z.enum(["6-9", "10-12", "13-17", "18-20"])),
    }),
    admin: z.object({ pageSize: z.number().int().min(10).max(100) }),
    features: z.object({
      publishing: z.boolean(),
      comments: z.boolean(),
      reactions: z.boolean(),
      selfEdit: z.boolean(),
      selfRemove: z.boolean(),
      fullName: z.boolean(),
      penName: z.boolean(),
      googleIndexing: z.boolean(),
      writerPages: z.boolean(),
      share: z.boolean(),
    }),
    featured: z.object({
      enabled: z.boolean(),
      title: textSchema.min(1).max(40),
      respectFilters: z.boolean(),
    }),
    texts: z.object({
      heroTitle: textSchema.min(1).max(80),
      heroSubtitle: textSchema.min(1).max(240),
      emptyMessage: textSchema.min(1).max(160),
      publishGuidelines: textSchema.min(0).max(800),
      closedNotice: textSchema.min(1).max(240),
    }),
    categories: z
      .array(categorySchema)
      .min(1)
      .max(12)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.key)).size === rows.length &&
          rows.some((row) => row.enabled),
        "يجب أن تكون الأكواد فريدة مع تصنيف مفعّل",
      ),
    reactions: z
      .array(reactionSchema)
      .length(3)
      .refine(
        (rows) => new Set(rows.map((row) => row.key)).size === 3,
        "التفاعلات الثلاثة مطلوبة دون تكرار",
      ),
    reportReasons: z
      .array(reportReasonSchema)
      .length(5)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.key)).size === 5 &&
          rows.some((row) => row.enabled),
        "الأسباب الخمسة مطلوبة مع سبب مفعّل",
      ),
  })
  .superRefine((value, ctx) => {
    for (const [min, max] of [
      ["bodyMin", "bodyMax"],
      ["penNameMin", "penNameMax"],
      ["guardianReasonMin", "guardianReasonMax"],
    ] as const) {
      if (value.limits[min] > value.limits[max])
        ctx.addIssue({
          code: "custom",
          path: ["limits", max],
          message: "الحد الأقصى لا يقل عن الحد الأدنى",
        });
    }
    if (!value.filters.sorts.includes(value.filters.defaultSort))
      ctx.addIssue({
        code: "custom",
        path: ["filters", "defaultSort"],
        message: "اختر ترتيبًا مفعّلًا",
      });
  });
export const aqlamBlockedWordsSchema = z
  .array(
    textSchema.refine(
      (value) => [...value].length >= 2 && [...value].length <= 40,
      "من ٢ إلى ٤٠ حرفًا",
    ),
  )
  .max(300);
export type AqlamConfigValues = z.output<typeof aqlamConfigSchema>;
