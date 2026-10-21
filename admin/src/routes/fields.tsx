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
      { title: "الرحلة · الحقول والنماذج" },
      {
        name: "description",
        content: "حقول Shadcn وحالات النماذج وTanStack Form.",
      },
    ],
  }),
  component: FieldsRoutePage,
});

function FieldsRoutePage() {
  return <FieldsPage activeSection={Route.useLoaderData().activeSection} />;
}
