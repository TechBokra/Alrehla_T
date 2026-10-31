import { useId, type ReactNode } from "react";
import type { BaseRecord } from "@refinedev/core";
import { LoaderCircle, Save } from "lucide-react";
import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResourceFormCrud } from "@/hooks/resources/use-resource-form-crud";

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
  dataProviderName,
  onClose,
  canEdit = () => true,
  getErrorMessage = () => "تعذّر حفظ البيانات. حاول مرة أخرى.",
  onSaved,
  children,
}: {
  resource: string;
  id?: string;
  title: string;
  dataProviderName?: string;
  onClose: () => void;
  canEdit?: (record: TRecord) => boolean;
  getErrorMessage?: (error: unknown) => string;
  onSaved?: (record: TRecord, action: "create" | "edit") => void;
  children: (context: ResourceFormDialogContext<TRecord>) => ReactNode;
}) {
  const formId = useId();
  const editing = id !== undefined;
  const crud = useResourceFormCrud<TRecord>({
    resource,
    id,
    dataProviderName,
    canEdit,
    getErrorMessage,
    onSaved,
  });
  async function save(values: Record<string, unknown>) {
    if (await crud.save(values)) onClose();
  }
  return (
    <FormDialog
      open
      title={title}
      description="راجع البيانات ثم اضغط حفظ."
      pending={crud.pending}
      onOpenChange={(open) => {
        if (!open && crud.canDismiss()) onClose();
      }}
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            disabled={crud.busy || crud.initialError || crud.unavailable}
            aria-busy={crud.pending}
          >
            {crud.pending ? <LoaderCircle className="animate-spin" /> : <Save />}
            {crud.pending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={crud.pending}
            onClick={onClose}
          >
            إلغاء
          </Button>
        </>
      }
    >
      <div aria-busy={crud.busy} className="flex flex-col gap-4">
        {crud.initialLoading ? (
          <div role="status" className="flex flex-col gap-3">
            <span>جارٍ تحميل السجل…</span>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : crud.initialError ? (
          <div role="alert" className="flex flex-col gap-3">
            <p>
              {crud.state === "forbidden"
                ? "هذا السجل غير متاح للتعديل هنا."
                : crud.state === "missing"
                  ? "السجل غير موجود أو غير متاح لحسابك."
                  : "تعذّر تحميل السجل. حاول مرة أخرى."}
            </p>
            {crud.state === "failed" && (
              <Button
                variant="outline"
                onClick={() => void crud.retryLoad()}
              >
                إعادة المحاولة
              </Button>
            )}
          </div>
        ) : (
          <>
            {crud.fetching && (
              <p
                role="status"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <LoaderCircle className="size-4 animate-spin" />
                جارٍ تحديث البيانات…
              </p>
            )}
            {crud.error && (
              <p role="alert" className="text-destructive">
                {crud.error}
              </p>
            )}
            {children({
              record: crud.record,
              formId,
              disabled: crud.busy || crud.unavailable,
              onSave: save,
            })}
          </>
        )}
      </div>
    </FormDialog>
  );
}
