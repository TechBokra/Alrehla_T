import { createFileRoute } from "@tanstack/react-router";
import { CustomizationFieldsPage } from "@/features/catalog/settings/page";
export const Route = createFileRoute("/catalog/settings/customization-fields")({
  component: CustomizationFieldsPage,
});
