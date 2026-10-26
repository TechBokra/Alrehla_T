import { z } from "zod";
import { moneySchema, recordIdSchema, textSchema } from "./common";

// Sources: actions/finance, withdrawals, instructors.
export const payoutPaidSchema = z.object({ payoutId: recordIdSchema });
export const withdrawalDecisionSchema = z
  .object({
    requestId: recordIdSchema,
    status: z.enum(["approved", "paid", "rejected"]),
    adminNotes: textSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "rejected" && !value.adminNotes)
      ctx.addIssue({
        code: "custom",
        path: ["adminNotes"],
        message: "اكتب سبب الرفض",
      });
  });
export const pricingFormulaSchema = z.object({
  multiplier: z.number().finite().positive(),
  fixedFee: moneySchema,
});
export const instructorPricingFormulaSchema = z.object({
  platformMultiplier: z.number().finite().positive(),
  fixedAdminFee: moneySchema,
});
