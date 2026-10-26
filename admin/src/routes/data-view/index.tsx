import { createFileRoute } from "@tanstack/react-router";
import { DataViewPage, type DataViewMode } from "@/features/component-showcase/pages/data-view-page";

export const Route = createFileRoute("/data-view/")({ component: DataViewRoutePage });

function DataViewRoutePage() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <DataViewPage
      selectedView={view ?? "table"}
      onViewChange={(nextView: DataViewMode) =>
        navigate({ search: (previous) => ({ ...previous, view: nextView }) })
      }
    />
  );
}
