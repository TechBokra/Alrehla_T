import { createFileRoute } from "@tanstack/react-router";
import { ThemePage } from "@/features/component-showcase/pages/theme-page";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";

export const Route = createFileRoute("/theme")({
  loader: () => ({ activeSection: "theme" as const }),
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "Calesee Admin · Theme" },
      {
        name: "description",
        content: "Calesee Admin design tokens and theme preview.",
      },
    ],
  }),
  component: ThemeRoutePage,
});

function ThemeRoutePage() {
  return <ThemePage activeSection={Route.useLoaderData().activeSection} />;
}
