import { ResourceProps } from "@refinedev/core";

export const resources: Array<ResourceProps> = [
  {
    name: "profile",
    list: "/profile",
    meta: { label: "الملف الشخصي", dataProviderName: "account" },
  },
  {
    name: "uploads",
    list: "/uploads",
    meta: { label: "المرفوعات", dataProviderName: "mediaLibrary" },
  },
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
