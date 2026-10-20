import { createFileRoute } from "@tanstack/react-router";
import { FieldsPage } from "@/features/component-showcase/pages/fields-page";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/fields")({
  loader: () => ({ activeSection: "fields" as const }),
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "Calesee Admin · Fields & forms" },
      {
        name: "description",
        content: "Shadcn fields, form states, and TanStack Form.",
      },
    ],
  }),
  component: FieldsRoutePage,
});

function FieldsRoutePage() {
  return <FieldsPage activeSection={Route.useLoaderData().activeSection} />;
}
