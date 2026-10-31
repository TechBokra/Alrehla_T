import { useRef, useState } from "react";
import {
  useCreate,
  useOne,
  useUpdate,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import { editRecordState } from "./lifecycle";

type ResourceFormAction = "create" | "edit";

export interface UseResourceFormCrudOptions<TRecord extends BaseRecord> {
  resource: string;
  id?: string;
  dataProviderName?: string;
  canEdit?: (record: TRecord) => boolean;
  getErrorMessage?: (error: unknown) => string;
  onSaved?: (record: TRecord, action: ResourceFormAction) => void;
}

/** Refine form reads, create/update mutations, guards and cache invalidation. */
export function useResourceFormCrud<TRecord extends BaseRecord>({
  resource,
  id,
  dataProviderName,
  canEdit = () => true,
  getErrorMessage = () => "تعذّر حفظ البيانات. حاول مرة أخرى.",
  onSaved,
}: UseResourceFormCrudOptions<TRecord>) {
  const editing = id !== undefined;
  const loaded = useRef(false);
  const inFlight = useRef(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const query = useOne<TRecord, HttpError>({
    resource,
    dataProviderName,
    id: id ?? "",
    errorNotification: false,
    queryOptions: {
      enabled: editing,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: "always",
    },
  });
  const create = useCreate<TRecord, HttpError, Record<string, unknown>>({
    mutationOptions: { retry: false },
  });
  const update = useUpdate<TRecord, HttpError, Record<string, unknown>>({
    mutationOptions: { retry: false },
  });
  const pending = create.mutation.isPending || update.mutation.isPending;
  const mutationError = editing
    ? update.mutation.error
    : create.mutation.error;
  // Refine owns CRUD mutation state; local state covers only work outside
  // those calls.
  const error =
    flowError ?? (mutationError ? getErrorMessage(mutationError) : null);
  const fetching = editing && (query.query.isPending || query.query.isFetching);
  const state = editRecordState({
    loading: fetching,
    error: query.query.error,
    record: query.result,
    canEdit,
  });
  if (editing && state === "ready") loaded.current = true;

  const initialLoading = editing && !loaded.current && fetching;
  const initialError =
    editing && !loaded.current && !fetching && state !== "ready";
  const busy = pending || fetching;
  const unavailable = editing && (!query.result || !canEdit(query.result));

  async function save(values: Record<string, unknown>) {
    if (inFlight.current || busy || unavailable) return false;
    inFlight.current = true;
    setFlowError(null);
    try {
      const common = { resource, dataProviderName };
      let saved: TRecord;
      if (editing) {
        try {
          const fresh = await query.query.refetch();
          if (fresh.error) throw fresh.error;
          if (!fresh.data?.data || !canEdit(fresh.data.data))
            throw { code: "42501" };
        } catch (failure) {
          setFlowError(getErrorMessage(failure));
          return false;
        }
        try {
          saved = (
            await update.mutateAsync({ ...common, id: id!, values })
          ).data;
        } catch {
          // Refine's update mutation owns and exposes its pending/error state.
          return false;
        }
      } else {
        try {
          saved = (await create.mutateAsync({ ...common, values })).data;
        } catch {
          // Refine's create mutation owns and exposes its pending/error state.
          return false;
        }
      }
      try {
        onSaved?.(saved, editing ? "edit" : "create");
      } catch (failure) {
        setFlowError(getErrorMessage(failure));
        return false;
      }
      return true;
    } finally {
      inFlight.current = false;
    }
  }

  return {
    record: query.result,
    state,
    fetching,
    initialLoading,
    initialError,
    busy,
    unavailable,
    pending,
    error,
    save,
    retryLoad: () => query.query.refetch(),
    canDismiss: () => !inFlight.current,
  };
}
