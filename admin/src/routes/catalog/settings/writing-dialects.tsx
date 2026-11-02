import { createFileRoute } from "@tanstack/react-router";
import { WritingDialectsPage } from "@/features/catalog/settings/page";
export const Route = createFileRoute("/catalog/settings/writing-dialects")({
  component: WritingDialectsPage,
});
