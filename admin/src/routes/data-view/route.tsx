import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
import { ShowcaseError, ShowcasePending } from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/data-view")({
  validateSearch: z.object({
    view: z.enum(["table", "kanban", "calendar"]).optional(),
  }),
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
  component: FeatureLayout,
});

function FeatureLayout() {
  return (
    <ShowcaseLayout activeSection="data-view">
      <Outlet />
    </ShowcaseLayout>
  );
}
