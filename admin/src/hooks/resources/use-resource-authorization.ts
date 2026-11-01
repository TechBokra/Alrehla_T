import { useCan, type CanParams } from "@refinedev/core";
import { useAdminAccess, useAdminSessionVersion } from "@/hooks/auth/use-admin-access";
import { evaluateResourceAccess } from "@/providers/refine/access-control-provider";

/** Version scopes Refine permission queries to the current auth session. */
export function useResourceAuthorization(resource: string, action: string, params?: CanParams["params"]) {
  const access = useAdminAccess();
  const authVersion = useAdminSessionVersion();
  const ready = access?.ready === true && access.version === authVersion;
  const policyParams = { ...params, authVersion, permissionsVersion: access?.permissionsVersion };
  const query = useCan({
    resource,
    action,
    params: policyParams,
    queryOptions: {
      enabled: ready,
      initialData: ready && access ? () => evaluateResourceAccess(access.actor, { resource, action, params: policyParams }) : undefined,
      staleTime: 60_000,
      gcTime: 0,
      retry: false,
      // The shared access provider owns focus refresh for the whole session.
      refetchOnWindowFocus: false,
    },
  });
  return { ...query, allowed: ready && !query.isError && query.data?.can === true };
}
