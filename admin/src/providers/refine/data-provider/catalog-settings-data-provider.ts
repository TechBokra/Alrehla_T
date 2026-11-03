import { assertResourceAccess } from "../access-control-provider";
import {
  adminDataProvider,
  DataConfigurationError,
} from "./supabase-data-provider";
import { createCatalogSettingsDataProvider } from "./catalog-settings-adapter";
import { supabaseConnection } from "@/providers/supabase-client";
import {
  saveProductPersonalization,
  type PersonalizationProduct,
} from "./product-personalization-command";

export const catalogSettingsDataProvider = createCatalogSettingsDataProvider(
  adminDataProvider,
  (resource, action, id) => assertResourceAccess(resource, action, { id }),
  async (params) => {
    if (
      params.url !== "product-personalization/save" ||
      params.method !== "post"
    )
      throw new Error("هذا الإجراء غير متاح لإعدادات الكتالوج.");
    const client = supabaseConnection.getClient();
    if (!client) throw new DataConfigurationError();
    const result = await saveProductPersonalization(params.payload, {
      authorizeProduct: (id) =>
        assertResourceAccess("personalized_products", "edit", { id }),
      readProduct: async (id) =>
        (
          await adminDataProvider.getOne<PersonalizationProduct>({
            resource: "personalized_products",
            id,
            meta: { select: "id,owner_type,category" },
          })
        ).data,
      authorizeDefinition: (resource, id) =>
        assertResourceAccess(resource, "edit", { id }),
      readDefinitions: async (resource, ids) => {
        const { data, error } = await client
          .from(resource)
          .select("id,updated_at,applies_to")
          .in("id", ids);
        if (error) throw error;
        return data ?? [];
      },
      writeScope: async (change) => {
        const { data, error } = await client
          .from(change.resource)
          .update({
            applies_to: change.appliesTo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", change.id)
          .eq("updated_at", change.expectedUpdatedAt)
          .contains("applies_to", change.expectedAppliesTo)
          .containedBy("applies_to", change.expectedAppliesTo)
          .select("id,applies_to,updated_at")
          .maybeSingle();
        if (error) throw error;
        return data ?? undefined;
      },
    });
    return { data: result };
  },
);
