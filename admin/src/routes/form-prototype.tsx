import { createFileRoute } from "@tanstack/react-router";
import { FormPrototypePage } from "@/features/form-prototype";
import { ShowcaseLayout } from "@/features/component-showcase/showcase-layout";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/form-prototype")({
  loader: () => ({ activeSection: "form-prototype" as const }),
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "Calesee Admin · Form prototype" },
      {
        name: "description",
        content: "An app-local TanStack Form composition and Refine demo.",
      },
    ],
  }),
  component: FormPrototypeRoutePage,
});

function FormPrototypeRoutePage() {
  return (
    <ShowcaseLayout activeSection={Route.useLoaderData().activeSection}>
      <FormPrototypePage />
    </ShowcaseLayout>
  );
}
