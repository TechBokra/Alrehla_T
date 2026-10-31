import {
  createRootRoute,
  HeadContent,
  Outlet,
  redirect,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { RootError } from "@/components/route-states/global-error";
import { NotFound } from "@/components/route-states/not-found";
import { getSupabaseClient } from "@/providers/supabase-client";
import { Loading } from "@/components/route-states/loading";
import { SiteBrandingProvider } from "@/features/site-branding/provider";
import { AdminIdentityProvider } from "@/features/auth/identity-provider";
import { adminAuthProvider } from "@/providers/refine/auth-provider";
import { RefineProvider } from "@/providers/refine/provider";

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const pathname = location.pathname.replace(/\/+$/, "") || "/";
    // The OAuth callback must exchange its code before any session guard runs.
    if (["/auth/callback", "/auth/link", "/reset-password"].includes(pathname))
      return;
    const { authenticated } = await adminAuthProvider.check();
    if (pathname === "/sign-in") {
      if (authenticated)
        throw redirect({ to: "/", replace: true });
      return;
    }
    if (!authenticated) throw redirect({ to: "/sign-in", replace: true });
  },
  component: RootLayout,
  pendingComponent: Loading,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/+$/, "") || "/",
  });
  const isStandaloneRoute =
    pathname === "/sign-in" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/");

  useEffect(() => {
    const supabase = getSupabaseClient();
    let userId: string | undefined;
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      const changedAccount = session?.user.id !== userId;
      userId = session?.user.id;
      if (
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        (event === "SIGNED_IN" && changedAccount)
      ) {
        queueMicrotask(() => {
          void router.invalidate();
        });
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [router]);

  return (
    <RefineProvider>
      <HeadContent />
      <SiteBrandingProvider>
        <AdminIdentityProvider>
          {isStandaloneRoute ? (
            <Outlet />
          ) : (
            <AdminLayout>
              <Outlet />
            </AdminLayout>
          )}
        </AdminIdentityProvider>
      </SiteBrandingProvider>
    </RefineProvider>
  );
}
