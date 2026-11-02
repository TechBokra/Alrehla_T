import type { Product } from "../model";
import type { ProductImageSelection, ProductPageValues } from "./schema";

export function valuesFromProduct(row: Product): ProductPageValues {
  const coverUrl = row.cover_image_url || row.gallery_image_urls?.find(Boolean) || null;
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
    images: coverUrl ? [{ kind: "saved", url: coverUrl } satisfies ProductImageSelection] : [],
    isActive: row.is_active,
  };
}

