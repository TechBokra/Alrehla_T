import { createFileRoute, Navigate } from "@tanstack/react-router";

import { resolveAdminLandingPage } from "@/providers/refine/access-control-provider";
import { useAdminAccess } from "@/hooks/auth/use-admin-access";

export const Route = createFileRoute("/")({
  component: AdminLanding,
});

function AdminLanding() {
  const access = useAdminAccess();
  if (!access?.ready) return null;
  return <Navigate to={resolveAdminLandingPage(access.actor)} replace />;
}
