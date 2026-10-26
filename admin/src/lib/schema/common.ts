import { z } from "zod";

/** Legacy resource IDs include text IDs; only auth/profile IDs require UUIDs. */
export const recordIdSchema = z.string().trim().min(1, "اختر السجل");
export const profileIdSchema = z.string().uuid("معرّف الحساب غير صالح");
export const requiredTextSchema = z.string().trim().min(1, "هذا الحقل مطلوب");
export const textSchema = z.string().trim();
export const moneySchema = z
  .number()
  .finite("أدخل رقمًا صحيحًا")
  .nonnegative("القيمة لا تقل عن صفر");
export const sortOrderSchema = z.number().finite().int();
export const emailSchema = z
  .string()
  .trim()
  .email("أدخل بريدًا إلكترونيًا صحيحًا")
  .toLowerCase();
export const httpUrlSchema = z
  .string()
  .trim()
  .url("أدخل رابطًا صحيحًا")
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "استخدم رابط HTTP أو HTTPS");
export const optionalHttpUrlSchema = z.union([z.literal(""), httpUrlSchema]);
export const cloudinaryUrlSchema = httpUrlSchema.refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}, "ارفع الصورة من الموقع");
export const optionalCloudinaryUrlSchema = z.union([
  z.literal(""),
  cloudinaryUrlSchema,
]);
export const recordActionSchema = z.object({ id: recordIdSchema });
export const activeStateSchema = recordActionSchema.extend({
  isActive: z.boolean(),
});

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour = "0", minute = "0"] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(Number(hour), Number(minute), 0, 0);
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day) &&
    Number(hour) < 24 &&
    Number(minute) < 60
  );
}
export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "أدخل تاريخًا صحيحًا")
  .refine(validCalendarDate, "التاريخ غير صالح");
/** Wall-clock Cairo input: validate only; the server owns timezone conversion. */
export const cairoDateTimeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "أدخل التاريخ والوقت")
  .refine(validCalendarDate, "التاريخ غير صالح");
export const instantSchema = z
  .string()
  .datetime({ offset: true, message: "أدخل وقتًا مع المنطقة الزمنية" });
export const listQuerySchema = z.object({
  search: textSchema.default(""),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(20),
});
export type ListQuery = z.output<typeof listQuerySchema>;
