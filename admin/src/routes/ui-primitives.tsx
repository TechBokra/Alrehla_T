import { createFileRoute } from "@tanstack/react-router";
import { UiPrimitivesPage } from "@/features/component-showcase/pages/ui-primitives-page";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/ui-primitives")({
  loader: () => ({ activeSection: "ui-primitives" as const }),
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
  component: UiPrimitivesRoutePage,
});

function UiPrimitivesRoutePage() {
  return (
    <UiPrimitivesPage activeSection={Route.useLoaderData().activeSection} />
  );
}
