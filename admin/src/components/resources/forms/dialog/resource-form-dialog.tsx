import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import type { BaseRecord } from "@refinedev/core";
import { LoaderCircle, Save } from "lucide-react";
import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResourceFormCrud } from "@/hooks/resources";
import { useResourceUploads } from "@/contexts/resource-page/uploads";
import { resolveImageSelectionUrls } from "@/hooks/uploads";
import type { ResourceFormDialogContext } from "../types";

export type { ResourceFormDialogContext } from "../types";

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
  const [formValid, setFormValid] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string>();
  const preparingRef = useRef(false);
  const uploads = useResourceUploads();
  const hasPendingUploads = Object.values(uploads).some(
    (upload) =>
      upload.uploading ||
      upload.items.some(
        (item) => !["success", "error", "rejected", "cancelled"].includes(item.status),
      ),
  );
  const uploadBlocked = Object.values(uploads).some(
    (upload) =>
      upload.failed ||
      (upload.items.length > 0 && (upload.accessPending || !upload.allowed)),
  );
  const crud = useResourceFormCrud<TRecord>({
    resource,
    id,
    dataProviderName,
    canEdit,
    getErrorMessage,
    onSaved,
  });
  const resolveImages = useCallback(
    async (slot: string, images: Parameters<typeof resolveImageSelectionUrls>[1]) => {
      const upload = uploads[slot];
      if (!upload) throw new Error("إعداد رفع الصور غير مكتمل لهذا الحقل.");
      return resolveImageSelectionUrls(upload.resolve, images);
    },
    [uploads],
  );
  async function save(values: Record<string, unknown>) {
    setPrepareError(undefined);
    if (await crud.save(values)) {
      for (const upload of Object.values(uploads)) upload.clearCompleted();
      onClose();
    }
  }
  async function submit(
    prepare: () => Record<string, unknown> | Promise<Record<string, unknown>>,
  ) {
    if (preparingRef.current || crud.busy || uploadBlocked) return;
    preparingRef.current = true;
    setPreparing(true);
    setPrepareError(undefined);
    try {
      await save(await prepare());
    } catch (error) {
      setPrepareError(getErrorMessage(error));
    } finally {
      preparingRef.current = false;
      setPreparing(false);
    }
  }
  const dialogPending = crud.pending || preparing || hasPendingUploads;
  return (
    <FormDialog
      open
      title={title}
      description="راجع البيانات ثم اضغط حفظ."
      pending={dialogPending}
      onOpenChange={(open) => {
        if (!open && crud.canDismiss() && !preparing && !hasPendingUploads)
          onClose();
      }}
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            disabled={
              crud.busy ||
              crud.initialError ||
              crud.unavailable ||
              !formValid ||
              preparing ||
              uploadBlocked
            }
            aria-busy={crud.pending || preparing}
          >
            {crud.pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Save />
            )}
            {preparing && !crud.pending
              ? "جارٍ تجهيز الصورة…"
              : crud.pending
                ? "جارٍ الحفظ…"
                : "حفظ"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={crud.pending || preparing || hasPendingUploads}
            onClick={onClose}
          >
            إلغاء
          </Button>
        </>
      }
    >
      <div aria-busy={crud.busy || preparing} className="flex flex-col gap-4">
        {crud.initialLoading ? (
          <div role="status" className="flex flex-col gap-3">
            <span>جارٍ تحميل السجل…</span>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : crud.initialError ? (
          <div role="alert" className="flex flex-col gap-3">
            <p>
              {crud.error ??
                (crud.state === "forbidden"
                  ? "هذا السجل غير متاح للتعديل هنا."
                  : crud.state === "missing"
                    ? "السجل غير موجود أو غير متاح لحسابك."
                    : "تعذّر تحميل السجل. حاول مرة أخرى.")}
            </p>
            {crud.canRetry && (
              <Button variant="outline" onClick={() => void crud.retryLoad()}>
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
            {prepareError && (
              <p role="alert" className="text-destructive">
                {prepareError}
              </p>
            )}
            {children({
              record: crud.record,
              formId,
              disabled: crud.busy || preparing || crud.unavailable,
              onFormValidityChange: setFormValid,
              onSave: save,
              uploads,
              resolveImages,
              submit,
            })}
          </>
        )}
      </div>
    </FormDialog>
  );
}
