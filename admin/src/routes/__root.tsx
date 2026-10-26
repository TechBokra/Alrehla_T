import {
  createRootRoute,
  HeadContent,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Refine } from "@refinedev/core";
import { RootError } from "@/components/route-states/global-error";
import { NotFound } from "@/components/route-states/not-found";
import { adminAuthProvider } from "@/features/auth/supabase";
import { getSupabaseClient } from "@/providers/supabase-client";
import { adminDataProvider } from "@/providers/data-provider";
import { notificationsDataProvider } from "@/features/notifications/data-provider";
import { authRouterProvider } from "@/features/auth/router-provider";
import { arabicEgyptI18nProvider } from "@/lib/i18n-provider";
import { useNotificationProvider } from "@/components/refine-ui/notification/use-notification-provider";
import { Loading } from "@/components/route-states/loading";
import { resources } from "@/features/catalog/resources";
import { SiteBrandingProvider } from "@/features/site-branding/provider";

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
  pendingComponent: Loading,
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
        queueMicrotask(() => {
          void router.invalidate();
        });
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [router]);

  return (
    <Refine
      resources={resources}
      dataProvider={{
        default: adminDataProvider,
        siteSettings: adminDataProvider,
        notifications: notificationsDataProvider,
      }}
      authProvider={adminAuthProvider}
      routerProvider={authRouterProvider}
      notificationProvider={notificationProvider}
      i18nProvider={arabicEgyptI18nProvider}
      options={{ disableTelemetry: true, disableRouteChangeHandler: true }}
    >
      <HeadContent />
      <SiteBrandingProvider>
        <Outlet />
      </SiteBrandingProvider>
    </Refine>
  );
}
