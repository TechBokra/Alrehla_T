import type { Database } from "@/types/supabase";
import { productSlug } from "../model";
import { addonSchema, type AddonFormValues } from "@/lib/schema";
export type Addon = Database["public"]["Tables"]["addon_products"]["Row"];
export function defaultAddonValues(): AddonFormValues {
  return {
    name: "",
    description: "",
    longDescription: "",
    price: "",
    imageUrl: "",
    isActive: false,
    sortOrder: "0",
  };
}
export function addonValues(row: Addon): AddonFormValues {
  return {
    name: row.name,
    description: row.description ?? "",
    longDescription: row.long_description ?? "",
    price: String(row.price),
    imageUrl: row.image_url ?? "",
    isActive: row.is_active,
    sortOrder: String(row.sort_order),
  };
}
export function addonUpdate(input: AddonFormValues) {
  const value = addonSchema.parse(input);
  return {
    name: value.name,
    description: value.description || null,
    long_description: value.longDescription || null,
    price: Number(value.price),
    image_url: value.imageUrl || null,
    is_active: value.isActive,
    sort_order: Number(value.sortOrder),
    supports_customization: true,
    customization_price: 0,
    updated_at: new Date().toISOString(),
  } satisfies Database["public"]["Tables"]["addon_products"]["Update"];
}
export function addonCreate(input: AddonFormValues) {
  return {
    ...addonUpdate(input),
    slug: productSlug(input.name),
    is_active: false,
  } satisfies Database["public"]["Tables"]["addon_products"]["Insert"];
}
