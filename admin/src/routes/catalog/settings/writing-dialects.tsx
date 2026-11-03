import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/catalog/settings/writing-dialects")({
  beforeLoad: () => {
    throw redirect({
      to: "/settings",
      search: { tab: "writing-dialects" },
      replace: true,
    });
  },
});
