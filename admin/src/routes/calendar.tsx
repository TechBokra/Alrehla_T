import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseLayout } from "@/features/component-showcase/showcase-layout";
import {
  ShowcaseError,
  ShowcasePending,
} from "@/features/component-showcase/route-states";
import { CalendarPage } from "@/features/calendar";

export const Route = createFileRoute("/calendar")({
  loader: () => ({ activeSection: "calendar" as const }),
  pendingComponent: ShowcasePending,
  errorComponent: ShowcaseError,
  head: () => ({
    meta: [
      { title: "Calesee Admin · Calendar" },
      {
        name: "description",
        content: "Calendar views with interactive, in-memory sample events.",
      },
    ],
  }),
  component: CalendarRoutePage,
});

function CalendarRoutePage() {
  return (
    <ShowcaseLayout activeSection={Route.useLoaderData().activeSection}>
      <CalendarPage />
    </ShowcaseLayout>
  );
}
