import { z } from "zod";

export const collectionSchema = z.enum(["accessories", "home", "apparel"]);
export const statusSchema = z.enum(["draft", "active", "archived"]);
export const channelSchema = z.enum(["storefront", "marketplace", "pos"]);
export const layoutSchema = z.enum(["grid", "list", "compact"]);
export const placementSchema = z.enum(["storefront", "email", "social"]);
export const tagSchema = z.enum([
  "new-arrival",
  "best-seller",
  "sustainable",
  "handmade",
  "limited-edition",
  "sale",
]);

export const allFieldsSchema = z.object({
  title: z.string().trim().min(2, "اكتب حرفين على الأقل."),
  email: z.string().trim().email("اكتب بريد إلكتروني صحيح."),
  password: z.string().min(8, "استخدم ٨ أحرف على الأقل."),
  quantity: z
    .number({ invalid_type_error: "اكتب الكمية." })
    .int("اكتب عددًا صحيحًا بدون كسور.")
    .min(1, "الكمية لازم تكون ١ على الأقل.")
    .max(10000, "الحد الأقصى للكمية ١٠٬٠٠٠."),
  search: z.string().max(100, "اكتب ١٠٠ حرف أو أقل."),
  website: z.string().trim().url("اكتب رابط كامل يبدأ بـ https://."),
  launchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "اختار تاريخًا.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "اختار تاريخًا صحيحًا."),
  launchTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "اختار وقتًا صحيحًا."),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "اختار لونًا صحيحًا."),
  phone: z
    .string()
    .regex(
      /^\+?[\d\s()-]{7,20}$/,
      "اكتب رقم هاتف من ٧ إلى ٢٠ خانة."
    ),
  description: z
    .string()
    .trim()
    .min(10, "اكتب ١٠ أحرف على الأقل.")
    .max(1000, "اكتب ١٬٠٠٠ حرف أو أقل."),
  price: z
    .number({ invalid_type_error: "اكتب السعر." })
    .positive("السعر لازم يكون أكبر من صفر."),
  collection: collectionSchema,
  status: statusSchema,
  publishingStatus: statusSchema,
  channels: z.array(channelSchema).min(1, "اختار قناة بيع واحدة على الأقل."),
  published: z.boolean(),
  notifications: z.boolean(),
  discount: z.number().min(0).max(100),
  category: collectionSchema,
  verificationCode: z.string().regex(/^\d{6}$/, "أدخل الأرقام الستة كاملة."),
  layout: layoutSchema,
  featured: z.boolean(),
  placements: z.array(placementSchema).min(1, "اختار مكان ظهور واحدًا على الأقل."),
  tags: z
    .array(tagSchema)
    .min(1, "اختار وسمًا واحدًا على الأقل.")
    .max(5, "اختار ٥ وسوم كحد أقصى.")
    .refine(
      (tags) => new Set(tags).size === tags.length,
      "ما ينفعش تختار الوسم نفسه أكتر من مرة."
    ),
  attachments: z
    .array(
      z.custom<File>(
        (value) => typeof File !== "undefined" && value instanceof File,
        "اختار ملفًا صحيحًا."
      )
    )
    .max(5, "ارفق ٥ ملفات كحد أقصى.")
    .refine(
      (files) => files.every((file) => file.size <= 10 * 1024 * 1024),
      "حجم كل ملف لازم يكون ١٠ ميجابايت أو أقل."
    ),
});

export type AllFieldsValues = z.infer<typeof allFieldsSchema>;

export function createExampleValues(): AllFieldsValues {
  return {
    title: "حقيبة قماش يومية",
    email: "admin@example.com",
    password: "Demo-only-123!",
    quantity: 24,
    search: "حقيبة",
    website: "https://example.com/products/linen-tote",
    launchDate: "2026-10-20",
    launchTime: "09:30",
    color: "#3366ff",
    phone: "+20 100 000 0000",
    description: "حقيبة يومية متينة مصنوعة من الكتان الطبيعي.",
    price: 34,
    collection: "accessories",
    status: "draft",
    publishingStatus: "draft",
    channels: ["storefront"],
    published: false,
    notifications: true,
    discount: 25,
    category: "accessories",
    verificationCode: "123456",
    layout: "grid",
    featured: true,
    placements: ["storefront"],
    tags: ["new-arrival", "sustainable"],
    attachments: [],
  };
}

export function serializeFormValues(values: AllFieldsValues) {
  return {
    ...values,
    attachments: values.attachments.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    })),
  };
}

export type SubmittedFieldValues = ReturnType<typeof serializeFormValues>;
