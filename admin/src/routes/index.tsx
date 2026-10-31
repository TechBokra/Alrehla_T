import { createFileRoute, redirect } from "@tanstack/react-router";

import { resolveAdminLandingPage } from "@/providers/refine/access-control-provider";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    throw redirect({ to: await resolveAdminLandingPage() });
  },
});
