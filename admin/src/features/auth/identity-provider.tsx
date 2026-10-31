import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useGetIdentity } from "@refinedev/core";
import { useLocation } from "@tanstack/react-router";
import { adminAuthProvider } from "@/providers/refine/auth-provider";

type AdminIdentity = {
  id: string;
  name: string | null;
  email?: string;
  avatar: string | null;
  role: "super_admin" | "general_supervisor";
};
type IdentityQuery = ReturnType<typeof useGetIdentity<AdminIdentity | null>>;
const IdentityContext = createContext<IdentityQuery | null>(null);

export function AdminIdentityProvider({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const version = useSyncExternalStore(
    adminAuthProvider.subscribeSession,
    adminAuthProvider.getSessionVersion,
    adminAuthProvider.getSessionVersion,
  );
  const path = pathname.replace(/\/+$/, "") || "/";
  const identity = useGetIdentity<AdminIdentity | null>({
    queryOptions: {
      queryKey: ["admin-identity", version],
      enabled: ![
        "/sign-in",
        "/auth/callback",
        "/auth/link",
        "/reset-password",
      ].includes(path),
      staleTime: 60_000,
      gcTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });
  return (
    <IdentityContext.Provider value={identity}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useAdminIdentity() {
  const identity = useContext(IdentityContext);
  if (!identity)
    throw new Error("useAdminIdentity requires AdminIdentityProvider");
  return identity;
}
