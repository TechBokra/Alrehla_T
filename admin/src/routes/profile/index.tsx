import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/features/profile/page";
import { ResourceAccessGate } from "@/components/resources";

export const Route = createFileRoute("/profile/")({
  component: AuthorizedProfilePage,
  head: () => ({ meta: [{ title: "الملف الشخصي · الرحلة" }] }),
});

function AuthorizedProfilePage() {
  return <ResourceAccessGate resource="profile" action="list"><ProfilePage /></ResourceAccessGate>;
}
