import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/settings/page";
import { ResourceAccessGate } from "@/components/resources";
import { z } from "zod";
import { activeSettingsTabValues } from "@/features/settings/tabs";
import { useAdminAccess } from "@/hooks/auth/use-admin-access";

export const Route = createFileRoute("/settings")({
  validateSearch: z.object({
    tab: z
      .enum(activeSettingsTabValues)
      .optional()
      .catch(undefined),
  }),
  component: SettingsRoute,
  head: () => ({ meta: [{ title: "الإعدادات · الرحلة" }] }),
});

function SettingsRoute() {
  const { tab } = Route.useSearch();
  const access = useAdminAccess();
  const actor = access?.actor;
  const canManageCatalog =
    actor?.role === "super_admin" ||
    actor?.permissions.includes("canManageCatalog") === true;
  const canManagePlatform =
    actor?.role === "super_admin" ||
    actor?.permissions.includes("canManageContent") === true;
  const activeTab =
    tab ?? (canManageCatalog ? "customization-fields" : "identity-contact");
  const resource =
    activeTab === "identity-contact" ? "site_settings" : "catalog_settings";
  return (
    <ResourceAccessGate resource={resource} action="list">
      <SettingsPage
        tab={activeTab}
        canManageCatalog={canManageCatalog}
        canManagePlatform={canManagePlatform}
      />
    </ResourceAccessGate>
  );
}
