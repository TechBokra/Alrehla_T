import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
import { ShowcaseError, ShowcasePending } from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/form-prototype")({
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "الرحلة · تجربة النماذج" },
      {
        name: "description",
        content: "تجربة محلية لتركيب النماذج وربطها بعمليات Refine.",
      },
    ],
  }),
  component: FeatureLayout,
});

function FeatureLayout() {
  return (
    <ShowcaseLayout activeSection="form-prototype">
      <Outlet />
    </ShowcaseLayout>
  );
}
