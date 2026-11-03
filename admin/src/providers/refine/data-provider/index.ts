import type { DataProviders } from "@refinedev/core";
import { adminDataProvider } from "./supabase-data-provider";
import { siteSettingsDataProvider } from "./site-settings-data-provider";
import { notificationsDataProvider } from "./notifications-data-provider";
import { profileDataProvider } from "./account-data-provider";
import { usersDataProvider } from "./users-data-provider";
import { ordersDataProvider } from "./orders-data-provider";
import { catalogSettingsDataProvider } from "./catalog-settings-data-provider";
import { promotionsDataProvider } from "./promotions-data-provider";

export const refineDataProviders = {
  default: adminDataProvider,
  siteSettings: siteSettingsDataProvider,
  notifications: notificationsDataProvider,
  account: profileDataProvider,
  users: usersDataProvider,
  orders: ordersDataProvider,
  catalogSettings: catalogSettingsDataProvider,
  promotions: promotionsDataProvider,
} satisfies DataProviders;
