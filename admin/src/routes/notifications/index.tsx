import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/features/notifications/page";

import { ResourceAccessGate } from "@/components/resources";

export const Route = createFileRoute("/notifications/")({
  component: AuthorizedNotificationsPage,
});

function AuthorizedNotificationsPage() {
  return <ResourceAccessGate resource="notifications" action="list"><NotificationsPage /></ResourceAccessGate>;
}
