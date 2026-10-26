import { createFileRoute } from "@tanstack/react-router";
import { AddonsPage } from "@/features/catalog/addons/page";
export const Route = createFileRoute("/catalog/addons/")({
  component: AddonsPage,
});
