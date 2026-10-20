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
      { title: "Calesee Admin · UI primitives" },
      {
        name: "description",
        content: "Buttons, overlays, menus, and feedback components.",
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
