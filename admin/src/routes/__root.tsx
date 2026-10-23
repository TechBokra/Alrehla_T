import {
  createRootRoute,
  HeadContent,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Refine } from "@refinedev/core";
import { RootPending } from "@/components/route-states/root-pending";
import { RootError } from "@/components/route-states/root-error";
import { NotFound } from "@/components/route-states/not-found";
import { adminAuthProvider, getSupabaseClient } from "@/features/auth/supabase";
import { authRouterProvider } from "@/features/auth/router-provider";
import { arabicEgyptI18nProvider } from "@/lib/i18n-provider";
import { useNotificationProvider } from "@/components/refine-ui/notification/use-notification-provider";

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const pathname = location.pathname.replace(/\/+$/, "") || "/";
    // The OAuth callback must exchange its code before any session guard runs.
    if (pathname === "/auth/callback") return;
    const { authenticated } = await adminAuthProvider.check();
    if (pathname === "/sign-in") {
      if (authenticated) throw redirect({ to: "/theme", replace: true });
      return;
    }
    if (!authenticated) throw redirect({ to: "/sign-in", replace: true });
  },
  component: RootLayout,
  pendingComponent: RootPending,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const router = useRouter();
  const notificationProvider = useNotificationProvider();
  useEffect(() => {
    const supabase = getSupabaseClient();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queueMicrotask(() => { void router.invalidate(); });
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [router]);

  return (
    <Refine
      authProvider={adminAuthProvider}
      routerProvider={authRouterProvider}
      notificationProvider={notificationProvider}
      i18nProvider={arabicEgyptI18nProvider}
      options={{ disableTelemetry: true, disableRouteChangeHandler: true }}
    >
      <HeadContent />
      <Outlet />
    </Refine>
  );
}
