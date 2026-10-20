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
  title: z.string().trim().min(2, "Enter at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  quantity: z
    .number({ invalid_type_error: "Enter a quantity." })
    .int("Use a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(10000),
  search: z.string().max(100, "Use 100 characters or fewer."),
  website: z.string().trim().url("Enter a complete URL, including https://."),
  launchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Choose a valid calendar date."),
  launchTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time in HH:mm format."),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Choose a valid hex color."),
  phone: z
    .string()
    .regex(
      /^\+?[\d\s()-]{7,20}$/,
      "Enter a phone number using 7–20 characters."
    ),
  description: z
    .string()
    .trim()
    .min(10, "Use at least 10 characters.")
    .max(1000),
  price: z
    .number({ invalid_type_error: "Enter a price." })
    .positive("Price must be greater than zero."),
  collection: collectionSchema,
  status: statusSchema,
  publishingStatus: statusSchema,
  channels: z.array(channelSchema).min(1, "Select at least one sales channel."),
  published: z.boolean(),
  notifications: z.boolean(),
  discount: z.number().min(0).max(100),
  category: collectionSchema,
  verificationCode: z.string().regex(/^\d{6}$/, "Enter all 6 digits."),
  layout: layoutSchema,
  featured: z.boolean(),
  placements: z.array(placementSchema).min(1, "Select at least one placement."),
  tags: z
    .array(tagSchema)
    .min(1, "Select at least one tag.")
    .max(5, "Select up to 5 tags.")
    .refine(
      (tags) => new Set(tags).size === tags.length,
      "Each tag can only be selected once."
    ),
  attachments: z
    .array(
      z.custom<File>(
        (value) => typeof File !== "undefined" && value instanceof File,
        "Choose a valid file."
      )
    )
    .max(5, "Attach up to 5 files.")
    .refine(
      (files) => files.every((file) => file.size <= 10 * 1024 * 1024),
      "Each file must be 10 MB or smaller."
    ),
});

export type AllFieldsValues = z.infer<typeof allFieldsSchema>;

export function createExampleValues(): AllFieldsValues {
  return {
    title: "Linen market tote",
    email: "admin@example.com",
    password: "Demo-only-123!",
    quantity: 24,
    search: "linen",
    website: "https://example.com/products/linen-tote",
    launchDate: "2026-10-20",
    launchTime: "09:30",
    color: "#3366ff",
    phone: "+20 100 000 0000",
    description: "A durable everyday bag made from natural linen.",
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
