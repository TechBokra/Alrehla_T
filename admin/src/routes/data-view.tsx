import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DataViewPage } from "@/features/component-showcase/pages/data-view-page";
import type { DataViewMode } from "@/features/component-showcase/pages/data-view-page";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/data-view")({
  validateSearch: z.object({
    view: z.enum(["table", "kanban", "calendar"]).optional(),
  }),
  loader: () => ({ activeSection: "data-view" as const }),
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "الرحلة · عرض البيانات" },
      {
        name: "description",
        content: "إدارة بيانات المتجر في الجداول والتقويم ولوحة المتابعة.",
      },
    ],
  }),
  component: DataViewRoutePage,
});

function DataViewRoutePage() {
  const { activeSection } = Route.useLoaderData();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <DataViewPage
      activeSection={activeSection}
      selectedView={view ?? "table"}
      onViewChange={(nextView: DataViewMode) =>
        navigate({
          search: (previous) => ({ ...previous, view: nextView }),
        })
      }
    />
  );
}
