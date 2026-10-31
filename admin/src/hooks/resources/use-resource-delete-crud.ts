import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import { useResourceAuthorization } from "./use-resource-authorization";
import { useRef, useState } from "react";
import {
  useDelete,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";

export interface UseResourceDeleteCrudOptions {
  resource: string;
  id: string;
  canDelete: boolean;
  record?: BaseRecord;
}

/** Pessimistic Refine delete with retry protection and the default cache refresh. */
export function useResourceDeleteCrud<TRecord extends BaseRecord>({
  resource,
  id,
  canDelete,
  record,
}: UseResourceDeleteCrudOptions) {
  const access = useResourceAuthorization(resource, "delete", { id, record });
  const [permissionError, setPermissionError] = useState<Error | null>(null);
  const [checking, setChecking] = useState(false);
  const deletion = useDelete<TRecord, HttpError>({
    mutationOptions: { retry: false },
  });
  const inFlight = useRef(false);

  async function remove() {
    if (inFlight.current || !canDelete || !access.allowed) return false;
    inFlight.current = true;
    setChecking(true);
    setPermissionError(null);
    try {
      await assertResourceAccess(resource, "delete", { id, record });
    } catch (failure) {
      setPermissionError(failure instanceof Error ? failure : new Error("تعذّر التحقق من صلاحية الحذف."));
      inFlight.current = false;
      return false;
    } finally {
      setChecking(false);
    }
    try {
      await deletion.mutateAsync({
        resource,
        id,
        mutationMode: "pessimistic",
      });
      return true;
    } catch {
      // Keep the dialog open and allow a deliberate retry after a failed delete.
      inFlight.current = false;
      return false;
    }
  }

  return {
    isPending: checking || deletion.mutation.isPending,
    allowed: access.allowed,
    error: permissionError ?? deletion.mutation.error,
    remove,
    canDismiss: () => !inFlight.current,
  };
}
