import { useCallback, useEffect, type ReactNode } from "react";
import { useGetIdentity, useIsAuthenticated, usePermissions } from "@refinedev/core";
import { Navigate, useLocation } from "@tanstack/react-router";
import { adminAuthProvider, type AdminAuthorization, type AdminIdentity } from "./auth-provider";
import { AdminAccessContext, useAdminSessionVersion } from "@/hooks/auth/use-admin-access";
import { useAdminBranding } from "@/hooks/auth/use-admin-branding";
import { Loading } from "@/components/route-states/loading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Refine owns the queries; this boundary keeps protected reads unmounted. */
export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const path = useLocation({ select: (location) => location.pathname.replace(/\/+$/, "") || "/" });
  const bypass = path.startsWith("/auth/") || path === "/reset-password";
  const signIn = path === "/sign-in";
  const version = useAdminSessionVersion();
  // Explicit keys prevent Refine's default auth key carrying across accounts.
  const authOptions = {
    queryKey: ["admin-auth", version],
    enabled: !bypass,
    staleTime: 60_000,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  };
  const auth = useIsAuthenticated({ queryOptions: authOptions });
  const authenticated = !auth.isError && !auth.data?.error && auth.data?.authenticated === true;
  const profileId = auth.data && "profileId" in auth.data && typeof auth.data.profileId === "string"
    ? auth.data.profileId : undefined;
  const loadProtected = !bypass && !signIn && authenticated && Boolean(profileId);
  // Identity reuses the verified session while Refine owns its query cache.
  const identity = useGetIdentity<AdminIdentity | null>({
    queryOptions: {
      queryKey: ["admin-identity", version],
      enabled: loadProtected,
      staleTime: 60_000,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  // Identity, branding and permissions load together behind the same gate.
  const site = useAdminBranding({ enabled: loadProtected, version, profileId });
  const permissions = usePermissions<AdminAuthorization | null>({
    options: {
      queryKey: ["admin-access", version],
      enabled: loadProtected,
      staleTime: 60_000,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
    },
  });

  const refresh = useCallback(() => {
    if (bypass || version !== adminAuthProvider.getSessionVersion() ||
      auth.isFetching || permissions.isFetching || identity.isFetching) return;
    if (signIn || !authenticated) {
      void auth.refetch();
      return;
    }
    // Start a fresh session read; Refine permissions and identity share it.
    // Same-session background refresh preserves open forms and upload queues.
    void adminAuthProvider.getAuthorization(true).catch(() => undefined);
    void permissions.refetch().then((result) => {
      if (version !== adminAuthProvider.getSessionVersion() || result.isError) return;
      if (result.data?.id !== permissions.data?.id || result.data?.role !== permissions.data?.role)
        adminAuthProvider.invalidateSession();
    });
    void identity.refetch();
  }, [bypass, signIn, authenticated, auth.isFetching, auth.refetch,
    permissions.isFetching, permissions.refetch, permissions.data,
    identity.isFetching, identity.refetch, version]);

  useEffect(() => {
    if (bypass) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [bypass, refresh]);

  useEffect(() => {
    if (!signIn && !auth.isError && !auth.data?.error && !permissions.isError && !identity.isError && permissions.dataUpdatedAt > 0 &&
      Date.now() - permissions.dataUpdatedAt >= 60_000) refresh();
  }, [path, signIn, auth.isError, auth.data?.error, permissions.isError, permissions.dataUpdatedAt, identity.isError, refresh]);

  const ready = !bypass && !signIn && authenticated &&
    permissions.isSuccess && permissions.data != null && permissions.data.id === profileId &&
    identity.isSuccess && identity.data?.id === profileId &&
    identity.data.role === permissions.data.role && !site.query.isPending;
  const isLoading = !bypass && (auth.isPending || (!signIn && authenticated &&
    (permissions.isPending || identity.isPending || site.query.isPending)));
  const retry = () => adminAuthProvider.invalidateSession();
  let content: ReactNode;
  if (bypass) content = children;
  else if (auth.isPending) content = <Loading />;
  else if (auth.isError || auth.data?.error) content = <AccessFailure retry={retry} />;
  else if (!authenticated) content = signIn ? children : <Navigate to="/sign-in" replace />;
  else if (signIn) content = <Navigate to="/" replace />;
  else if (permissions.isError || identity.isError) content = <AccessFailure retry={retry} />;
  else if (permissions.isPending || identity.isPending || site.query.isPending ||
    (!ready && (permissions.isFetching || identity.isFetching))) content = <Loading />;
  else if (!ready) content = <AccessFailure denied retry={retry} />;
  else content = children;

  return (
    <AdminAccessContext.Provider value={{
      actor: ready ? permissions.data ?? null : null,
      version,
      permissionsVersion: permissions.dataUpdatedAt,
      ready,
      identity,
      branding: site.branding,
      isLoading,
      error: auth.error ?? auth.data?.error ?? permissions.error ?? identity.error ?? null,
      retry,
    }}>
      {content}
    </AdminAccessContext.Provider>
  );
}

function AccessFailure({ denied = false, retry }: { denied?: boolean; retry: () => void }) {
  return (
    <main dir="rtl" className="grid min-h-svh place-items-center bg-background p-6">
      <Alert className="max-w-md text-start">
        <AlertTitle>{denied ? "غير مصرح بالوصول" : "تعذّر التحقق من الحساب والصلاحيات"}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <p>{denied ? "هذا الحساب غير مصرح له بالدخول إلى لوحة الإدارة." : "تعذّر تحميل بيانات الدخول أو الصلاحيات. تحقق من الاتصال وحاول مرة أخرى."}</p>
          <Button variant="outline" onClick={retry}>إعادة المحاولة</Button>
        </AlertDescription>
      </Alert>
    </main>
  );
}
