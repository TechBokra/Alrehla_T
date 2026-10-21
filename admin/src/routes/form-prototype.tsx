import { createFileRoute } from "@tanstack/react-router";
import { FormPrototypePage } from "@/features/form-prototype";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
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
      { title: "الرحلة · تجربة النماذج" },
      {
        name: "description",
        content: "تجربة محلية لتركيب النماذج وربطها بعمليات Refine.",
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
