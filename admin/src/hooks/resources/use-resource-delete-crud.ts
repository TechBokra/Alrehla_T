import { useRef } from "react";
import {
  useDelete,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";

export interface UseResourceDeleteCrudOptions {
  resource: string;
  id: string;
  canDelete: boolean;
}

/** Pessimistic Refine delete with retry protection and the default cache refresh. */
export function useResourceDeleteCrud<TRecord extends BaseRecord>({
  resource,
  id,
  canDelete,
}: UseResourceDeleteCrudOptions) {
  const deletion = useDelete<TRecord, HttpError>({
    mutationOptions: { retry: false },
  });
  const inFlight = useRef(false);

  async function remove() {
    if (inFlight.current || !canDelete) return false;
    inFlight.current = true;
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
    isPending: deletion.mutation.isPending,
    error: deletion.mutation.error,
    remove,
    canDismiss: () => !inFlight.current,
  };
}
