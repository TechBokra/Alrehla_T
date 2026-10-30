import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/features/profile/page";
export const Route = createFileRoute("/profile/")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "الملف الشخصي · الرحلة" }] }),
});
