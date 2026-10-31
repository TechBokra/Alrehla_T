import { useSyncExternalStore } from "react";
import { useCan, type CanParams } from "@refinedev/core";
import { adminAuthProvider } from "@/providers/refine/auth-provider";

/** Version scopes Refine permission queries to the current auth session. */
export function useResourceAuthorization(resource: string, action: string, params?: CanParams["params"]) {
  const authVersion = useSyncExternalStore(
    adminAuthProvider.subscribeSession,
    adminAuthProvider.getSessionVersion,
    adminAuthProvider.getSessionVersion,
  );
  const query = useCan({
    resource,
    action,
    params: { ...params, authVersion },
    queryOptions: { staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: "always" },
  });
  return { ...query, allowed: !query.isError && query.data?.can === true };
}
