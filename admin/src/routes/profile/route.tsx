import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
export const Route = createFileRoute("/profile")({
  component: () => (
    <AdminLayout pageLabel="الملف الشخصي">
      <Outlet />
    </AdminLayout>
  ),
});
