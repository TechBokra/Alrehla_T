import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
export const Route = createFileRoute("/uploads")({
  component: () => (
    <AdminLayout pageLabel="المرفوعات">
      <Outlet />
    </AdminLayout>
  ),
});
