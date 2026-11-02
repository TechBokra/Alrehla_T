import type { DataProviders } from "@refinedev/core";
import { adminDataProvider } from "./supabase-data-provider";
import { notificationsDataProvider } from "./notifications-data-provider";
import { profileDataProvider } from "./account-data-provider";
import { mediaDataProvider } from "./media-library-data-provider";
import { usersDataProvider } from "./users-data-provider";
import { ordersDataProvider } from "./orders-data-provider";

export const refineDataProviders = {
  default: adminDataProvider,
  siteSettings: adminDataProvider,
  notifications: notificationsDataProvider,
  mediaLibrary: mediaDataProvider,
  account: profileDataProvider,
  users: usersDataProvider,
  orders: ordersDataProvider,
} satisfies DataProviders;
