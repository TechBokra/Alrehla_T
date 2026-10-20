import { createFileRoute } from "@tanstack/react-router";
import { DataViewPage } from "@/features/component-showcase/pages/data-view-page";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/data-view")({
  loader: () => ({ activeSection: "data-view" as const }),
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "Calesee Admin · Data view" },
      {
        name: "description",
        content: "Refine data tables, filters, and page views.",
      },
    ],
  }),
  component: DataViewRoutePage,
});

function DataViewRoutePage() {
  return <DataViewPage activeSection={Route.useLoaderData().activeSection} />;
}
