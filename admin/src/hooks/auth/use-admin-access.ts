import { createContext, useContext, useSyncExternalStore } from "react";
import type { useGetIdentity } from "@refinedev/core";
import { adminAuthProvider, type AdminAuthorization, type AdminIdentity } from "@/providers/refine/auth-provider";
import type { SiteBrandingValues } from "@/features/site-branding/model";

export interface AdminAccessState {
  actor: AdminAuthorization | null;
  version: number;
  permissionsVersion: number;
  ready: boolean;
  identity: ReturnType<typeof useGetIdentity<AdminIdentity | null>>;
  branding: SiteBrandingValues;
  isLoading: boolean;
  error: unknown;
  retry: () => void;
}

export const AdminAccessContext = createContext<AdminAccessState | null>(null);

export function useAdminAccess() {
  return useContext(AdminAccessContext);
}

function useRequiredAdminAccess() {
  const access = useAdminAccess();
  if (!access) throw new Error("Admin access hooks require AdminAccessProvider");
  return access;
}

/** All consumers share the root Refine identity query and its cache/state. */
export function useAdminIdentity() {
  return useRequiredAdminAccess().identity;
}

export function useSiteBranding() {
  const access = useRequiredAdminAccess();
  return { branding: access.branding, isLoading: access.isLoading };
}

export function useAdminSessionVersion() {
  return useSyncExternalStore(
    adminAuthProvider.subscribeSession,
    adminAuthProvider.getSessionVersion,
    adminAuthProvider.getSessionVersion,
  );
}
