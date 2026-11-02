import {
  createRootRoute,
  HeadContent,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { RootError } from "@/components/route-states/global-error";
import { NotFound } from "@/components/route-states/not-found";
import { AdminAccessProvider } from "@/providers/refine/admin-access-provider";
import { RefineProvider } from "@/providers/refine/provider";

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/+$/, "") || "/",
  });
  const isStandaloneRoute =
    pathname === "/sign-in" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/");

  return (
    <RefineProvider>
      <HeadContent />
      <AdminAccessProvider>
        {isStandaloneRoute ? (
          <Outlet />
        ) : (
          <AdminLayout>
            <Outlet />
          </AdminLayout>
        )}
      </AdminAccessProvider>
    </RefineProvider>
  );
}
