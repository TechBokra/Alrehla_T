import { createFileRoute } from "@tanstack/react-router";
import { UploadsPage } from "@/features/uploads/page";
import { ResourceAccessGate } from "@/components/resources/resource-access-gate";

export const Route = createFileRoute("/uploads/")({ component: AuthorizedUploadsPage });

function AuthorizedUploadsPage() {
  return <ResourceAccessGate resource="uploads" action="list"><UploadsPage /></ResourceAccessGate>;
}
