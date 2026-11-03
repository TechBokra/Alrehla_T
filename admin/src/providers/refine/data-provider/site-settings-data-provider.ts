import type { BaseRecord, DataProvider } from "@refinedev/core";
import { siteIdentityContactSchema } from "@/features/settings/identity-contact/model";
import { assertResourceAccess } from "../access-control-provider";
import { adminDataProvider } from "./supabase-data-provider";
import { getSupabaseClient } from "@/providers/supabase-client";
import type { Json } from "@/types/supabase";

export const siteSettingsDataProvider: DataProvider = {
  ...adminDataProvider,
  getList: async () => unsupportedSettingsOperation(),
  getMany: async () => unsupportedSettingsOperation(),
  create: async () => unsupportedSettingsOperation(),
  createMany: async () => unsupportedSettingsOperation(),
  update: async <TData extends BaseRecord>({
    resource,
    id,
    variables,
  }: Parameters<DataProvider["update"]>[0]) => {
    if (resource !== "site_settings" || String(id) !== "general") {
      throw new Error("يمكن تعديل بيانات الهوية والتواصل فقط من هذا النموذج.");
    }

    await assertResourceAccess("site_settings", "edit", { id: "general" });
    const values = siteIdentityContactSchema.parse(variables);
    const client = getSupabaseClient();
    if (!client) throw new Error("اتصال لوحة الإدارة غير مكتمل.");

    const { data: existing, error: readError } = await client
      .from("site_settings")
      .select("value")
      .eq("key", "general")
      .maybeSingle();
    if (readError) throw new Error("تعذر تحميل إعدادات الموقع قبل الحفظ.");

    const currentValue = asJsonObject(existing?.value);
    const nextValue = { ...currentValue };
    for (const [key, value] of Object.entries(values)) {
      if (value === "") delete nextValue[key];
      else nextValue[key] = value;
    }

    const { data, error } = await client
      .from("site_settings")
      .upsert(
        { key: "general", value: nextValue },
        { onConflict: "key" },
      )
      .select("id,key,value")
      .single();
    if (error) throw new Error("تعذر حفظ بيانات الهوية والتواصل.");

    try {
      const { data: authData } = await client.auth.getUser();
      const { error: auditError } = await client.from("audit_logs").insert({
        actor_profile_id: authData.user?.id ?? null,
        action: "site_settings_updated",
        entity_type: "SiteSettings",
        entity_id: "general",
        metadata: { changedFields: Object.keys(values) },
      });
      if (auditError) console.error("Error writing site settings audit log", auditError);
    } catch (auditError) {
      console.error("Error writing site settings audit log", auditError);
    }

    return { data: { ...data, id: data.key } as unknown as TData };
  },
  updateMany: async () => unsupportedSettingsOperation(),
  deleteOne: async () => unsupportedSettingsOperation(),
  deleteMany: async () => unsupportedSettingsOperation(),
  custom: async () => unsupportedSettingsOperation(),
};

function unsupportedSettingsOperation(): never {
  throw new Error("عمليات إعدادات الموقع متاحة من نماذج الإعدادات المعتمدة فقط.");
}

function asJsonObject(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
