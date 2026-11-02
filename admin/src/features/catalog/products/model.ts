import type { Database } from "@/types/supabase";
import { productSlug } from "../model";
import { productSchema, type ProductFormValues } from "@/lib/schema";
export type Product =
  Database["public"]["Tables"]["personalized_products"]["Row"];
export function defaultProductValues(): ProductFormValues {
  return {
    name: "",
    description: "",
    longDescription: "",
    price: "",
    electronicPrice: "",
    imageUrl: "",
    category: "library",
    isActive: false,
    sortOrder: "0",
  };
}
export function productValues(row: Product): ProductFormValues {
  return {
    name: row.name,
    description: row.short_description ?? "",
    longDescription: row.long_description ?? "",
    price: String(row.price),
    electronicPrice:
      row.electronic_price == null ? "" : String(row.electronic_price),
    imageUrl: row.cover_image_url ?? "",
    category: row.category === "custom" ? "custom" : "library",
    isActive: row.is_active,
    sortOrder: String(row.sort_order),
  };
}
export function productUpdate(input: ProductFormValues) {
  const value = productSchema.parse(input);
  return {
    name: value.name,
    short_description: value.description || null,
    long_description: value.longDescription || null,
    price: Number(value.price),
    ...(value.category === "custom"
      ? {
          electronic_price: value.electronicPrice
            ? Number(value.electronicPrice)
            : null,
        }
      : {}),
    cover_image_url: value.imageUrl || null,
    category: value.category,
    is_active: value.isActive,
    updated_at: new Date().toISOString(),
  } satisfies Database["public"]["Tables"]["personalized_products"]["Update"];
}
export function productCreate(input: ProductFormValues) {
  return {
    ...productUpdate(input),
    slug: productSlug(input.name),
    owner_type: "platform",
    publisher_id: null,
    publisher_cost: null,
    review_status: "approved",
    reviewed_at: new Date().toISOString(),
    is_active: false,
  } satisfies Database["public"]["Tables"]["personalized_products"]["Insert"];
}
export function isEditableProduct(row: Product) {
  return (
    row.owner_type === "platform" &&
    ["library", "custom"].includes(row.category)
  );
}
