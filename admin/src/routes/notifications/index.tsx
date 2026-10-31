import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/features/notifications/page";

import { ResourceAccessGate } from "@/components/resources/resource-access-gate";

export const Route = createFileRoute("/notifications/")({
  component: AuthorizedNotificationsPage,
});

function AuthorizedNotificationsPage() {
  return <ResourceAccessGate resource="notifications" action="list"><NotificationsPage /></ResourceAccessGate>;
}
