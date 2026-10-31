import type { ResourceProps } from "@refinedev/core";
import { Blocks, Images, Table2, Users } from "lucide-react";

const navigationItems = {
  users: { resource: "users", to: "/users", label: "المستخدمون", icon: Users },
  uploads: { resource: "uploads", to: "/uploads", label: "المرفوعات", icon: Images },
  products: { resource: "personalized_products", to: "/catalog/products", label: "منتجات المنصة", icon: Table2 },
  addons: { resource: "addon_products", to: "/catalog/addons", label: "الإضافات", icon: Blocks },
} as const;

export type AdminNavigationItem = (typeof navigationItems)[keyof typeof navigationItems];
export const adminNavigationGroups = [
  { label: "إدارة الحسابات", items: [navigationItems.users] },
  { label: "إدارة الكتالوج", items: [navigationItems.uploads, navigationItems.products, navigationItems.addons] },
] as const;

export const resources: ResourceProps[] = [
  { name: "profile", list: "/profile", meta: { label: "الملف الشخصي", dataProviderName: "account" } },
  ...Object.values(navigationItems).map((item) => ({
    name: item.resource,
    list: item.to,
    meta: {
      label: item.label,
      ...(item.resource === "users" ? { dataProviderName: "users" } : {}),
      ...(item.resource === "uploads" ? { dataProviderName: "mediaLibrary" } : {}),
    },
  })),
];
