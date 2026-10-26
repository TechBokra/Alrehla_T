import { ResourceProps } from "@refinedev/core";

export const resources: Array<ResourceProps> = [
  {
    name: "personalized_products",
    list: "/catalog/products",
    meta: { label: "منتجات المنصة" },
  },
  {
    name: "addon_products",
    list: "/catalog/addons",
    meta: { label: "الإضافات" },
  },
];
