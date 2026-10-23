import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
import { ShowcaseError, ShowcasePending } from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/fields")({
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "الرحلة · الحقول والنماذج" },
      {
        name: "description",
        content: "حقول Shadcn وحالات النماذج وTanStack Form.",
      },
    ],
  }),
  component: FeatureLayout,
});

function FeatureLayout() {
  return (
    <ShowcaseLayout activeSection="fields">
      <Outlet />
    </ShowcaseLayout>
  );
}
