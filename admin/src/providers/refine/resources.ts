import type { ResourceProps } from "@refinedev/core";
import { Blocks, Images, Tags, ShoppingBag, Table2, Users } from "lucide-react";

export const catalogSettingsItems = [
  {
    resource: "customization_fields",
    to: "/catalog/settings/customization-fields",
    label: "خانات التخصيص",
  },
  {
    resource: "story_goals",
    to: "/catalog/settings/story-goals",
    label: "أهداف التخصيص",
  },
  {
    resource: "writing_dialects",
    to: "/catalog/settings/writing-dialects",
    label: "لهجات الكتابة",
  },
] as const;

const navigationItems = {
  users: {
    resource: "users",
    to: "/users",
    mode: "dialog",
    label: "المستخدمون",
    icon: Users,
  },
  uploads: {
    resource: "uploads",
    to: "/uploads",
    label: "المرفوعات",
    icon: Images,
  },
  products: {
    resource: "personalized_products",
    to: "/catalog/products",
    mode: "page",
    label: "منتجات المنصة",
    icon: Table2,
  },
  orders: {
    resource: "orders",
    to: "/orders",
    mode: "details",
    label: "الطلبات",
    icon: ShoppingBag,
  },
  addons: {
    resource: "addon_products",
    to: "/catalog/addons",
    mode: "dialog",
    label: "الإضافات",
    icon: Blocks,
  },
  promotions: {
    resource: "price_promotions",
    to: "/catalog/promotions",
    mode: "dialog",
    label: "العروض والخصومات",
    icon: Tags,
  },
} as const;

export type AdminNavigationItem =
  (typeof navigationItems)[keyof typeof navigationItems];
export const adminNavigationGroups = [
  { label: "إدارة الحسابات", items: [navigationItems.users] },
  { label: "إدارة الطلبات", items: [navigationItems.orders] },
  {
    label: "إنها لك",
    items: [
      navigationItems.uploads,
      navigationItems.products,
      navigationItems.addons,
      navigationItems.promotions,
    ],
  },
] as const;

export const resources: ResourceProps[] = [
  {
    name: "profile",
    list: "/profile",
    meta: { label: "الملف الشخصي", dataProviderName: "account" },
  },
  ...catalogSettingsItems.map((item) => ({
    name: item.resource,
    list: item.to,
    meta: {
      label: item.label,
      formMode: "dialog",
      dataProviderName: "catalogSettings",
    },
  })),
  ...Object.values(navigationItems).map((item) => {
    const pageFormRoutes =
      "mode" in item && item.mode === "page"
        ? { create: `${item.to}/create`, edit: `${item.to}/:id/edit` }
        : {};
    const detailsRoutes =
      "mode" in item && item.mode === "details"
        ? { show: `${item.to}/:id` }
        : {};
    return {
      name: item.resource,
      list: item.to,
      ...pageFormRoutes,
      ...detailsRoutes,
      meta: {
        label: item.label,
        ...("mode" in item ? { formMode: item.mode } : {}),
        ...(item.resource === "users" ? { dataProviderName: "users" } : {}),
        ...(item.resource === "orders" ? { dataProviderName: "orders" } : {}),
        ...(item.resource === "uploads"
          ? { dataProviderName: "mediaLibrary" }
          : {}),
        ...(item.resource === "price_promotions"
          ? { dataProviderName: "promotions" }
          : {}),
      },
    };
  }),
];
