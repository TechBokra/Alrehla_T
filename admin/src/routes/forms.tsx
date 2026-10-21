import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseLayout } from "@/features/component-showcase/layout";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";
import { FormsPage } from "@/features/forms";

export const Route = createFileRoute("/forms")({
  loader: () => ({ activeSection: "forms" as const }),
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
  component: FormsRoutePage,
});

function FormsRoutePage() {
  return (
    <ShowcaseLayout activeSection={Route.useLoaderData().activeSection}>
      <FormsPage />
    </ShowcaseLayout>
  );
}
