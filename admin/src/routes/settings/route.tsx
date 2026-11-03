import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/settings/page";
import { ResourceAccessGate } from "@/components/resources";
import { z } from "zod";

export const Route = createFileRoute("/settings")({
  validateSearch: z.object({
    tab: z
      .enum(["customization-fields", "story-goals", "writing-dialects"])
      .optional()
      .catch(undefined),
  }),
  component: SettingsRoute,
  head: () => ({ meta: [{ title: "الإعدادات · الرحلة" }] }),
});

function SettingsRoute() {
  const { tab } = Route.useSearch();
  return (
    <ResourceAccessGate resource="catalog_settings" action="list">
      <SettingsPage tab={tab ?? "customization-fields"} />
    </ResourceAccessGate>
  );
}
