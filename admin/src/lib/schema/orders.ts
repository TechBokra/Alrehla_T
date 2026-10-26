import { z } from "zod";
import { recordIdSchema, textSchema, instantSchema } from "./common";

// Action contracts only. Payment verification, current-state transitions, receipt
// checks and payout side effects must run on the server, never inferred here.
export const orderFulfilmentSchema = z
  .object({
    orderId: recordIdSchema,
    status: z.enum(["preparing", "shipped", "delivered", "cancelled"]),
    trackingReference: textSchema.optional(),
    note: textSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "cancelled" && !value.note)
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "اكتب سبب الإلغاء",
      });
  });
export const electronicDeliverySchema = z.object({ orderId: recordIdSchema });
export const boxShipmentSchema = z.object({
  shipmentId: recordIdSchema,
  status: z.enum(["preparing", "shipped", "delivered"]),
  trackingReference: textSchema.optional(),
});
export const boxShipmentGoalSchema = z.object({
  shipmentId: recordIdSchema,
  goal: textSchema.max(200),
});
export const boxSubscriptionStatusSchema = z.object({
  subscriptionId: recordIdSchema,
  status: z.enum(["active", "paused", "cancelled"]),
});

export const serviceOrderCloseSchema = z.object({
  orderId: recordIdSchema,
  reason: textSchema.min(1, "اكتب السبب"),
});
export const serviceOrderDecisionSchema = serviceOrderCloseSchema.extend({
  status: z.enum(["refunded", "cancelled"]),
});

export const serviceOrderDueSchema = z
  .object({
    orderId: recordIdSchema,
    dueAt: instantSchema.nullable(),
    note: textSchema,
  })
  .refine((value) => !value.dueAt || Boolean(value.note), {
    path: ["note"],
    message: "اكتب سبب تغيير المهلة",
  });
