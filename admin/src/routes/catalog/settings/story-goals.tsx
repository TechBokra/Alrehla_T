import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/catalog/settings/story-goals")({
  beforeLoad: () => {
    throw redirect({
      to: "/settings",
      search: { tab: "story-goals" },
      replace: true,
    });
  },
});
