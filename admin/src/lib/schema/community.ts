import { z } from "zod";
import {
  profileIdSchema,
  recordIdSchema,
  requiredTextSchema,
  textSchema,
} from "./common";

// Sources: actions/support, reviews, aqlam; lib/aqlam/post (adminNoteMax = 500).
export const supportReplySchema = z.object({
  ticketId: recordIdSchema,
  message: requiredTextSchema,
});
export const supportRequestStatusSchema = z.object({
  id: recordIdSchema,
  status: z.enum(["pending", "contacted", "resolved"]),
});
export const reviewVisibilitySchema = z
  .object({
    reviewId: recordIdSchema,
    isHidden: z.boolean(),
    reason: textSchema,
  })
  .refine((value) => !value.isHidden || Boolean(value.reason), {
    path: ["reason"],
    message: "اكتب سبب الإخفاء",
  });
export const aqlamPostModerationSchema = z.object({
  postId: recordIdSchema,
  decision: z.enum([
    "approve",
    "reject",
    "hide",
    "restore",
    "remove",
    "feature",
    "unfeature",
  ]),
  reason: textSchema,
});
export const aqlamCommentModerationSchema = z.object({
  commentId: recordIdSchema,
  decision: z.enum(["hide", "restore", "remove"]),
  reason: textSchema,
});
export const aqlamReportDecisionSchema = z.object({
  reportId: recordIdSchema,
  decision: z.enum(["actioned", "dismissed"]),
});
export const aqlamSanctionSchema = z.object({
  userId: profileIdSchema,
  kind: z.enum(["warning", "suspension_7d", "permanent"]),
  reason: requiredTextSchema,
});
export const aqlamGuardianDecisionSchema = z
  .object({
    requestId: profileIdSchema,
    decision: z.enum(["approve", "reject"]),
    note: textSchema.max(500),
  })
  .refine((value) => value.decision !== "reject" || Boolean(value.note), {
    path: ["note"],
    message: "اكتب سبب الرفض",
  });
export const aqlamSettingsSchema = z.object({
  mode: z.enum(["off", "pilot", "public"]),
});
export const aqlamAllowlistSchema = z.object({
  userId: profileIdSchema,
  op: z.enum(["add", "remove"]),
});

export const aqlamPinSchema = z.object({
  postId: profileIdSchema,
  op: z.enum(["pin", "unpin", "up", "down"]),
});
