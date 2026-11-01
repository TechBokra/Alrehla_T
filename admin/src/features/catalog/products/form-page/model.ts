import type { Database } from "@/types/supabase";
import { productSlug } from "../../model";
import { productPageSchema, type ProductImageSelection, type ProductPageValues } from "./schema";
import type { Product } from "../model";

export function defaultValues(): ProductPageValues {
  return {
    name: "",
    category: "library",
    description: "",
    price: "",
    electronicPrice: "",
    writingStyles: [],
    minAge: "",
    maxAge: "",
    longDescription: "",
    featuresText: "",
    images: [],
    isActive: false,
  };
}

export function valuesFromProduct(row: Product): ProductPageValues {
  const imageUrls = [row.cover_image_url, ...(row.gallery_image_urls ?? [])]
    .filter((url): url is string => Boolean(url));
  return {
    name: row.name,
    category: row.category === "custom" ? "custom" : "library",
    description: row.short_description ?? "",
    price: String(row.price),
    electronicPrice: row.electronic_price == null ? "" : String(row.electronic_price),
    writingStyles: row.writing_styles ? [...row.writing_styles] as ProductPageValues["writingStyles"] : [],
    minAge: row.min_age == null ? "" : String(row.min_age),
    maxAge: row.max_age == null ? "" : String(row.max_age),
    longDescription: row.long_description ?? "",
    featuresText: (row.features ?? []).join("\n"),
    images: imageUrls.map((url) => ({ kind: "saved", url }) satisfies ProductImageSelection),
    isActive: row.is_active,
  };
}

function pagePayload(input: ProductPageValues, images: string[]) {
  const value = productPageSchema.parse(input);
  const styles = value.writingStyles;
  const writingStyles = styles.length === 3 ? null : styles.length ? styles : null;
  return {
    name: value.name,
    category: value.category,
    short_description: value.description || null,
    long_description: value.longDescription || null,
    price: Number(value.price),
    electronic_price:
      value.category === "custom" && value.electronicPrice
        ? Number(value.electronicPrice)
        : null,
    writing_styles: writingStyles,
    min_age: value.minAge ? Number(value.minAge) : null,
    max_age: value.maxAge ? Number(value.maxAge) : null,
    features: value.featuresText.split("\n").map((line) => line.trim()).filter(Boolean),
    cover_image_url: images[0] ?? null,
    gallery_image_urls: images.slice(1, 9),
    is_active: value.isActive,
    updated_at: new Date().toISOString(),
  };
}

export function toUpdatePayload(input: ProductPageValues, images: string[]) {
  return pagePayload(input, images) satisfies Database["public"]["Tables"]["personalized_products"]["Update"];
}

export function toCreatePayload(input: ProductPageValues, images: string[]) {
  return {
    ...pagePayload({ ...input, isActive: false }, images),
    slug: productSlug(input.name),
    owner_type: "platform",
    publisher_id: null,
    publisher_cost: null,
    review_status: "approved",
    reviewed_at: new Date().toISOString(),
    is_active: false,
  } satisfies Database["public"]["Tables"]["personalized_products"]["Insert"];
}

export type ProductPreparationRow = Product & {
  delivery_days_electronic?: number | null;
  delivery_days_printed?: number | null;
};

export function hasPreparationDaysColumns(row: Product): row is ProductPreparationRow & {
  delivery_days_electronic: number | null;
  delivery_days_printed: number | null;
} {
  return Object.hasOwn(row, "delivery_days_electronic") && Object.hasOwn(row, "delivery_days_printed");
}
