import { z } from "zod";
import {
  dateOnlySchema,
  moneySchema,
  optionalHttpUrlSchema,
  profileIdSchema,
  recordIdSchema,
  textSchema,
} from "./common";
import { workflowStepKeySchema } from "./workflow";

// Source: actions/studio.ts and lib/studio.ts. Database validates gates and assignments.
const projectFields = { projectId: profileIdSchema };
export const studioModeSchema = z.object({ mode: z.enum(["on", "off"]) });
export const studioStartSchema = z.object({
  orderItemId: profileIdSchema,
  orderId: recordIdSchema,
});
export const studioAssignmentSchema = z.object({
  ...projectFields,
  editorId: profileIdSchema.nullable(),
  artLeadId: profileIdSchema.nullable(),
  dueAt: dateOnlySchema.nullable(),
});
export const studioBriefSchema = z.object({
  ...projectFields,
  ageBand: z.enum(["", "6-9", "10-12", "13-17", "18-20"]),
  pageTarget: z.number().int().min(4).max(64).nullable(),
  faceMode: z.enum(["cartoon", "real"]),
  sensitiveTopic: z.boolean(),
});
export const studioVersionSchema = z.object({
  ...projectFields,
  body: textSchema.min(1).max(100000),
  source: z.enum(["ai", "editor"]),
  note: textSchema.max(2000),
});
export const studioClientDecisionSchema = z
  .object({
    ...projectFields,
    versionId: profileIdSchema,
    decision: z.enum(["approve", "changes"]),
    note: textSchema.max(1000),
  })
  .refine((value) => value.decision !== "approve" || value.note.length >= 5, {
    path: ["note"],
    message: "سجّل كيف ومتى وافق العميل",
  });
export const studioPageSchema = z.object({
  ...projectFields,
  pageNo: z.number().int().min(0).max(99),
  pageText: textSchema.max(4000),
  sceneDescription: textSchema.max(4000),
  imageUrl: optionalHttpUrlSchema
    .pipe(z.string().max(500))
    .refine(
      (value) => !value || value.startsWith("https://"),
      "استخدم رابط HTTPS",
    ),
});
export const studioPageReviewSchema = z
  .object({
    ...projectFields,
    pageId: profileIdSchema,
    decision: z.enum(["approved", "needs_redo"]),
    reviewerNote: textSchema.max(1000),
  })
  .refine(
    (value) =>
      value.decision !== "needs_redo" || value.reviewerNote.length >= 3,
    { path: ["reviewerNote"], message: "اكتب سبب الإعادة" },
  );
export const studioTransitionSchema = z.object({
  ...projectFields,
  to: workflowStepKeySchema,
  note: textSchema.max(1000),
});
export const studioCostSchema = z
  .object({
    ...projectFields,
    kind: z.enum(["tool", "human", "print", "shipping", "other"]),
    amount: moneySchema.max(1000000),
    minutes: z.number().int().min(0).max(100000).nullable(),
    note: textSchema.max(500),
  })
  .refine((value) => value.amount !== 0 || value.minutes !== null, {
    path: ["amount"],
    message: "أدخل مبلغًا أو دقائق",
  });

export const studioPhotoConsentSchema = z.object({
  ...projectFields,
  note: textSchema.min(5).max(1000),
});
export const studioCharacterSchema = z.object({
  ...projectFields,
  characterNotes: textSchema.max(4000),
  characterRefUrl: optionalHttpUrlSchema
    .pipe(z.string().max(500))
    .refine(
      (value) => !value || value.startsWith("https://"),
      "استخدم رابط HTTPS",
    ),
});
export const studioQaSchema = z.object({
  ...projectFields,
  story_engaging: z.boolean(),
  dialogue_age_fit: z.boolean(),
  art_matches_text: z.boolean(),
  hero_consistent: z.boolean(),
  arabic_text_ok: z.boolean(),
  print_ready: z.boolean(),
  sensitive_review: z.boolean(),
});
