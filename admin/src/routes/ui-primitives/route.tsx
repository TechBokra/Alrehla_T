import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
import { ShowcaseError, ShowcasePending } from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/ui-primitives")({
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "الرحلة · عناصر الواجهة" },
      {
        name: "description",
        content: "الأزرار والنوافذ والقوائم وحالات التفاعل.",
      },
    ],
  }),
  component: FeatureLayout,
});

function FeatureLayout() {
  return (
    <ShowcaseLayout activeSection="ui-primitives">
      <Outlet />
    </ShowcaseLayout>
  );
}
