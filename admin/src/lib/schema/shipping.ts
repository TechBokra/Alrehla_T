import { z } from "zod";
import {
  moneySchema,
  recordIdSchema,
  requiredTextSchema,
  textSchema,
} from "./common";

// Sources: lib/shipping.ts, actions/shipping.ts.
export const countryCodeSchema = textSchema
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "رمز الدولة حرفان إنجليزيان");
export const shippingRateSchema = z.object({
  id: recordIdSchema.optional(),
  countryCode: countryCodeSchema,
  governorate: requiredTextSchema,
  city: requiredTextSchema,
  fee: moneySchema.max(100000),
  isActive: z.boolean(),
  isEstimate: z.boolean(),
});
export const deliveryPauseSchema = z.object({
  paused: z.boolean(),
  message: textSchema.max(200),
});
export const shippingCountrySchema = z.object({
  code: countryCodeSchema,
  physicalEnabled: z.boolean(),
  electronicEnabled: z.boolean(),
  unavailableMessage: textSchema.max(200),
});
export const governorateSchema = z.object({
  countryCode: countryCodeSchema,
  name: requiredTextSchema.max(80),
});
export const governorateFlagsSchema = z.object({
  id: recordIdSchema,
  physicalEnabled: z.boolean(),
  isActive: z.boolean(),
});
export const shippingAdjustmentSchema = z.object({
  countryCode: countryCodeSchema,
  governorate: requiredTextSchema,
  delta: z
    .number()
    .finite()
    .refine((value) => value !== 0, "أدخل قيمة التعديل"),
});
