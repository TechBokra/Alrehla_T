import { assertResourceAccess } from "../access-control-provider";
import { adminDataProvider } from "./supabase-data-provider";
import { createCatalogSettingsDataProvider } from "./catalog-settings-adapter";

export const catalogSettingsDataProvider = createCatalogSettingsDataProvider(
  adminDataProvider,
  (resource, action, id) => assertResourceAccess(resource, action, { id }),
);
