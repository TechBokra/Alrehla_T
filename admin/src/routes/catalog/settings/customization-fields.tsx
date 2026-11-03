import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/catalog/settings/customization-fields")({
  beforeLoad: () => {
    throw redirect({
      to: "/settings",
      search: { tab: "customization-fields" },
      replace: true,
    });
  },
});
