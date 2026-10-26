import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
export const Route = createFileRoute("/catalog")({ component: CatalogLayout });
function CatalogLayout() {
  const path = useLocation({ select: (location) => location.pathname });
  return (
    <AdminLayout
      pageLabel={path.includes("addons") ? "الإضافات" : "منتجات المنصة"}
    >
      <Outlet />
    </AdminLayout>
  );
}
