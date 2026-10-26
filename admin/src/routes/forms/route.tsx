import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
import { ShowcaseError, ShowcasePending } from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/forms")({
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "الرحلة · النماذج" },
      {
        name: "description",
        content: "أنماط النماذج داخل النوافذ والألواح والأقسام.",
      },
    ],
  }),
  component: FeatureLayout,
});

function FeatureLayout() {
  return (
    <ShowcaseLayout activeSection="forms">
      <Outlet />
    </ShowcaseLayout>
  );
}
