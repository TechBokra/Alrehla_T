import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";

export const Route = createFileRoute("/notifications")({
  component: NotificationsLayout,
});

function NotificationsLayout() {
  return (
    <AdminLayout pageLabel="الإشعارات">
      <Outlet />
    </AdminLayout>
  );
}
