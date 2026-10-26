import { z } from "zod";
import {
  instantSchema,
  profileIdSchema,
  recordIdSchema,
  textSchema,
} from "./common";

// Sources: actions/work-tasks, studio-flow; lib/work-tasks, box-schedule.
export const workLineSchema = z.enum([
  "enha_lak",
  "box",
  "courses",
  "services",
  "studio",
]);
export const workflowStepKeySchema = textSchema.regex(
  /^[a-z][a-z0-9_]{1,40}$/,
  "كود المرحلة غير صالح",
);
export const assignmentRuleSchema = z.object({
  line: workLineSchema,
  stage: workflowStepKeySchema,
  profileIds: z.array(profileIdSchema),
});
export const taskReassignmentSchema = z.object({
  id: profileIdSchema,
  profileIds: z.array(profileIdSchema),
});
export const taskPrioritySchema = z.object({
  id: profileIdSchema,
  priority: z.enum(["low", "normal", "high", "urgent"]),
});
export const taskDueSchema = z.object({
  id: profileIdSchema,
  dueAtIso: instantSchema.nullable(),
}); // Server checks future/single-year window against its clock.
export const taskNoteSchema = z.object({
  id: profileIdSchema,
  note: textSchema.min(1, "اكتب الملاحظة").max(1000),
});
const slaHoursSchema = z.number().finite().min(0.25).max(2160).nullable();
export const taskStepSchema = z
  .object({
    line: workLineSchema,
    step: workflowStepKeySchema,
    label: textSchema.min(2).max(60),
    hint: textSchema.max(300),
    slaHours: slaHoursSchema,
    ownerKind: z.enum(["rule", "editor", "art_lead", "manager"]),
    showTab: z.boolean(),
  })
  .refine((value) => value.line !== "studio" || value.ownerKind !== "rule", {
    path: ["ownerKind"],
    message: "اختر مسؤول مرحلة الاستوديو",
  });
export const boxLeadDaysSchema = z.object({
  leadDays: z.number().finite().int().min(1).max(60),
});
export const studioStageSchema = z.object({
  label: textSchema.min(2).max(60),
  after: workflowStepKeySchema,
  ownerKind: z.enum(["editor", "art_lead", "manager"]),
  hint: textSchema.max(300),
  slaHours: slaHoursSchema,
});
export const studioStageMoveSchema = z.object({
  step: workflowStepKeySchema,
  dir: z.union([z.literal(-1), z.literal(1)]),
});
export const studioStageFlowSchema = z.object({
  step: workflowStepKeySchema,
  advanceBy: z.enum(["owner", "manager"]),
  active: z.boolean(),
  optional: z.boolean(),
});
export const studioProductRouteSchema = z.object({
  productId: recordIdSchema.max(120),
  steps: z
    .array(
      z.object({
        step: workflowStepKeySchema,
        state: z.enum(["required", "optional", "off"]),
      }),
    )
    .min(1),
});

export const studioEdgesSchema = z.object({
  from: workflowStepKeySchema,
  edges: z
    .array(
      z.object({
        to: workflowStepKeySchema,
        who: z.enum(["owner", "manager"]),
        skipGates: z.boolean(),
        pagesRedo: z.boolean(),
        resetQa: z.boolean(),
      }),
    )
    .refine(
      (edges) => new Set(edges.map((edge) => edge.to)).size === edges.length,
      "الانتقالات مكررة",
    ),
});
