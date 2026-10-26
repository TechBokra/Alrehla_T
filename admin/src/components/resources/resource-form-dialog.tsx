import { useId, useRef, useState, type ReactNode } from "react";
import {
  useCreate,
  useUpdate,
  useOne,
  useInvalidate,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { editRecordState, refreshSavedResource } from "./lifecycle";

export interface ResourceFormDialogContext<TRecord> {
  record?: TRecord;
  formId: string;
  disabled: boolean;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}

/** Shared create/edit controller and dialog. Features own fields and payloads. */
export function ResourceFormDialog<TRecord extends BaseRecord>({
  resource,
  id,
  title,
  onClose,
  canEdit = () => true,
  getErrorMessage = () => "تعذّر حفظ البيانات. حاول مرة أخرى.",
  children,
}: {
  resource: string;
  id?: string;
  title: string;
  onClose: () => void;
  canEdit?: (record: TRecord) => boolean;
  getErrorMessage?: (error: unknown) => string;
  children: (context: ResourceFormDialogContext<TRecord>) => ReactNode;
}) {
  const formId = useId();
  const editing = id !== undefined;
  const loaded = useRef(false);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useOne<TRecord, HttpError>({
    resource,
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
  const invalidate = useInvalidate();
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
  const unavailable =
    editing && (!query.result || !canEdit(query.result));
  async function save(values: Record<string, unknown>) {
    if (inFlight.current || busy || unavailable) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const common = {
        resource,
        successNotification: false as const,
        errorNotification: false as const,
        invalidates: [],
      };
      if (editing) {
        const fresh = await query.query.refetch();
        if (fresh.error) throw fresh.error;
        if (!fresh.data?.data || !canEdit(fresh.data.data))
          throw { code: "42501" };
        await update.mutateAsync({ ...common, id: id!, values });
      } else await create.mutateAsync({ ...common, values });
    } catch (failure) {
      setError(getErrorMessage(failure));
      inFlight.current = false;
      setPending(false);
      return;
    }
    const refreshed = await refreshSavedResource(() =>
      invalidate({
        resource,
        invalidates: editing ? ["list", "many", "detail"] : ["list", "many"],
        ...(editing ? { id } : {}),
      }),
    );
    toast.success("تم حفظ البيانات", {
      description: refreshed ? undefined : "حدّث القائمة لعرض آخر البيانات.",
    });
    onClose();
  }
  return (
    <FormDialog
      open
      title={title}
      description="راجع البيانات ثم اضغط حفظ."
      pending={pending}
      onOpenChange={(open) => {
        if (!open && !inFlight.current) onClose();
      }}
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            disabled={busy || initialError || unavailable}
            aria-busy={pending}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
            {pending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            إلغاء
          </Button>
        </>
      }
    >
      <div aria-busy={busy} className="flex flex-col gap-4">
        {initialLoading ? (
          <div role="status" className="flex flex-col gap-3">
            <span>جارٍ تحميل السجل…</span>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : initialError ? (
          <div role="alert" className="flex flex-col gap-3">
            <p>
              {state === "forbidden"
                ? "هذا السجل غير متاح للتعديل هنا."
                : state === "missing"
                  ? "السجل غير موجود أو غير متاح لحسابك."
                  : "تعذّر تحميل السجل. حاول مرة أخرى."}
            </p>
            {state === "failed" && (
              <Button
                variant="outline"
                onClick={() => void query.query.refetch()}
              >
                إعادة المحاولة
              </Button>
            )}
          </div>
        ) : (
          <>
            {fetching && (
              <p
                role="status"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <LoaderCircle className="size-4 animate-spin" />
                جارٍ تحديث البيانات…
              </p>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            {children({
              record: query.result,
              formId,
              disabled: busy || unavailable,
              onSave: save,
            })}
          </>
        )}
      </div>
    </FormDialog>
  );
}
