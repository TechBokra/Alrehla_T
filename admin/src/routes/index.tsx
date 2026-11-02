import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

/** The dashboard route intentionally has no page content yet. */
function DashboardPage() {
  return null;
}
