import { useRef, useState } from "react";
import {
  useForm as useRefineForm,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import { useResourceAuthorization } from "../authorization";
import { editRecordState } from "./lifecycle";

type ResourceFormAction = "create" | "edit";

export interface UseResourceFormCrudOptions<TRecord extends BaseRecord> {
  resource: string;
  id?: string;
  dataProviderName?: string;
  canEdit?: (record: TRecord) => boolean;
  getErrorMessage?: (error: unknown) => string;
  onSaved?: (record: TRecord, action: ResourceFormAction) => void | Promise<void>;
  suppressNotifications?: boolean;
  presentation?: "page" | "dialog";
  redirectAfterCreate?: "edit" | "list" | false;
}

/**
 * Thin guard/presentation adapter around Refine core useForm. Refine owns the
 * record query, create/update mutation, cache invalidation and redirect helper.
 */
export function useResourceFormCrud<TRecord extends BaseRecord>({
  resource,
  id,
  dataProviderName,
  canEdit = () => true,
  getErrorMessage = () => "تعذّر حفظ البيانات. حاول مرة أخرى.",
  onSaved,
  suppressNotifications = false,
  presentation = "dialog",
  redirectAfterCreate: redirectAfterCreateAction = "edit",
}: UseResourceFormCrudOptions<TRecord>) {
  const editing = id !== undefined;
  const action: ResourceFormAction = editing ? "edit" : "create";
  const access = useResourceAuthorization(resource, action, { id });
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lastFailure = useRef<unknown>(undefined);

  const refineForm = useRefineForm<
    TRecord,
    HttpError,
    Record<string, unknown>,
    TRecord,
    TRecord
  >({
    resource,
    action,
    id,
    dataProviderName,
    mutationMode: "pessimistic",
    redirect: false,
    queryOptions: {
      enabled: editing && access.allowed,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: "always",
    },
    createMutationOptions: { retry: false },
    updateMutationOptions: { retry: false },
    successNotification: suppressNotifications ? false : undefined,
    errorNotification: suppressNotifications ? false : undefined,
  });

  const record = refineForm.query?.data?.data;
  const mutationError = refineForm.mutation.error;
  const fetching = editing && access.allowed && Boolean(
    refineForm.query?.isPending || refineForm.query?.isFetching,
  );
  const queryError = refineForm.query?.error;
  const recordState = editRecordState({
    loading: fetching,
    error: queryError,
    record,
    canEdit,
  });
  const state = access.isError
    ? "failed"
    : !access.isPending && !access.allowed
      ? "forbidden"
      : recordState;
  const queryPending = editing && Boolean(refineForm.query?.isPending);
  const initialLoading = access.isPending || (editing && queryPending);
  const initialError =
    !access.isPending &&
    (!access.allowed || (editing && !fetching && state !== "ready"));
  const busy = checkingAccess || refineForm.mutation.isPending || fetching || access.isPending;
  const unavailable = !access.allowed || (editing && (!record || !canEdit(record)));
  const error =
    flowError ??
    (access.isError
      ? "تعذّر التحقق من الصلاحيات. حاول مرة أخرى."
      : !access.isPending && !access.allowed
        ? access.data?.reason
        : null) ??
    (mutationError ? getErrorMessage(mutationError) : null);

  async function save(values: Record<string, unknown>): Promise<TRecord | false> {
    if (inFlight.current || busy || unavailable) return false;
    inFlight.current = true;
    lastFailure.current = undefined;
    setFlowError(null);
    setCheckingAccess(true);
    try {
      await assertResourceAccess(resource, action, { id, record });
      if (editing) {
        const fresh = await refineForm.query?.refetch();
        const freshRecord = fresh?.data?.data;
        if (fresh?.error) throw fresh.error;
        if (!freshRecord || !canEdit(freshRecord)) {
          throw new Error("هذا السجل غير متاح لهذا الإجراء.");
        }
        await assertResourceAccess(resource, action, { id, record: freshRecord });
      }
      setCheckingAccess(false);
      const result = await refineForm.onFinish(values);
      const saved = result?.data as TRecord | undefined;
      if (!saved) throw new Error("لم يرجع النظام السجل المحفوظ.");
      await onSaved?.(saved, action);
      return saved;
    } catch (failure) {
      lastFailure.current = failure;
      // Refine keeps mutation errors on its mutation result. This local error
      // is only for authorization, record-refresh and post-save flow failures.
      if (!refineForm.mutation.error) {
        setFlowError(
          failure instanceof Error ? failure.message : getErrorMessage(failure),
        );
      }
      return false;
    } finally {
      setCheckingAccess(false);
      inFlight.current = false;
    }
  }

  async function refreshRecord(): Promise<TRecord | undefined> {
    if (!editing || !refineForm.query) return undefined;
    const refreshed = await refineForm.query.refetch();
    if (refreshed.error) throw refreshed.error;
    return refreshed.data?.data;
  }

  return {
    record,
    refineForm,
    state,
    fetching,
    initialLoading,
    initialError,
    busy,
    unavailable,
    pending: checkingAccess || refineForm.mutation.isPending,
    error,
    save,
    refreshRecord,
    redirectAfterCreate: (saved: TRecord) => {
      if (!editing && presentation === "page" && redirectAfterCreateAction) {
        refineForm.redirect(redirectAfterCreateAction, saved.id);
      }
    },
    getLastError: () => lastFailure.current ?? mutationError,
    canRetry: access.isError || state === "failed",
    retryLoad: async () => {
      const result = await access.refetch();
      if (result.data?.can && editing) await refineForm.query?.refetch();
    },
    canDismiss: () => !inFlight.current,
  };
}
