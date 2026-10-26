import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep old calendar bookmarks pointing to the Calendar tab in Data view. */
export const Route = createFileRoute("/calendar/")({
  beforeLoad: () => {
    throw redirect({
      to: "/data-view",
      search: { view: "calendar" },
    });
  },
});
