import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
import { ShowcaseError, ShowcasePending } from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/theme")({
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "الرحلة · التصميم والألوان" },
      {
        name: "description",
        content: "معاينة ألوان وخطوط وتصميم لوحة الإدارة.",
      },
    ],
  }),
  component: FeatureLayout,
});

function FeatureLayout() {
  return (
    <ShowcaseLayout activeSection="theme">
      <Outlet />
    </ShowcaseLayout>
  );
}
