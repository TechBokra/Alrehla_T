import { useRef, useState } from "react";
import {
  useCreate,
  useOne,
  useUpdate,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import { useResourceAuthorization } from "./use-resource-authorization";
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
  const access = useResourceAuthorization(resource, editing ? "edit" : "create", { id });
  const [checkingAccess, setCheckingAccess] = useState(false);
  const loaded = useRef(false);
  const inFlight = useRef(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const query = useOne<TRecord, HttpError>({
    resource,
    dataProviderName,
    id: id ?? "",
    errorNotification: false,
    queryOptions: {
      enabled: editing && access.allowed,
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
  const pending = checkingAccess || create.mutation.isPending || update.mutation.isPending;
  const mutationError = editing
    ? update.mutation.error
    : create.mutation.error;
  // Refine owns CRUD mutation state; local state covers only work outside
  // those calls.
  const error =
    flowError ?? (access.isError ? "تعذّر التحقق من الصلاحيات. حاول مرة أخرى." : !access.isPending && !access.allowed ? access.data?.reason : null) ?? (mutationError ? getErrorMessage(mutationError) : null);
  const fetching = editing && access.allowed && (query.query.isPending || query.query.isFetching);
  const state = editRecordState({
    loading: fetching,
    error: query.query.error,
    record: query.result,
    canEdit,
  });
  if (editing && state === "ready") loaded.current = true;

  const initialLoading = access.isPending || (editing && !loaded.current && fetching);
  const initialError =
    !access.isPending && (!access.allowed || (editing && !loaded.current && !fetching && state !== "ready"));
  const busy = pending || fetching || access.isPending;
  const unavailable = !access.allowed || (editing && (!query.result || !canEdit(query.result)));

  async function save(values: Record<string, unknown>) {
    if (inFlight.current || busy || unavailable) return false;
    inFlight.current = true;
    setFlowError(null);
    setCheckingAccess(true);
    try {
      await assertResourceAccess(resource, editing ? "edit" : "create", { id, record: query.result });
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
        setCheckingAccess(false);
        try {
          saved = (
            await update.mutateAsync({ ...common, id: id!, values })
          ).data;
        } catch {
          // Refine's update mutation owns and exposes its pending/error state.
          return false;
        }
      } else {
        setCheckingAccess(false);
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
    } catch (failure) {
      setFlowError(failure instanceof Error ? failure.message : getErrorMessage(failure));
      return false;
    } finally {
      setCheckingAccess(false);
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
    canRetry: access.isError || state === "failed",
    retryLoad: async () => {
      const result = await access.refetch();
      if (result.data?.can && editing) await query.query.refetch();
    },
    canDismiss: () => !inFlight.current,
  };
}
