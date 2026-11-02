import { useCallback, useRef } from "react";
import { useInvalidate, type BaseRecord } from "@refinedev/core";
import { toast } from "sonner";
import type { ResourceFormBaseContext, ResourceFormPageDefinition } from "@/components/resources/page/types";
import type { ResourceUploadHandles } from "@/hooks/uploads";
import { submitResourceForm, type ResourceFormSubmit } from "./form-submission";

/** Resource-owned lifecycle exposed to feature forms through context.submit. */
export function useResourceFormSubmission<TRecord extends BaseRecord>({
  definition,
  context,
  uploads,
}: {
  definition: ResourceFormPageDefinition<TRecord>;
  context: ResourceFormBaseContext<TRecord>;
  uploads: ResourceUploadHandles;
}): ResourceFormSubmit<TRecord> {
  const invalidate = useInvalidate();
  const guard = useRef({ pending: false });
  const successMessage = definition.page?.successMessage?.(context.mode);
  return useCallback((submission) => submitResourceForm(submission, {
    save: context.save,
    invalidate: async (saved) => {
      await invalidate({
        resource: definition.resource,
        dataProviderName: definition.dataProviderName,
        id: saved.id,
        invalidates: definition.page?.invalidates ?? ["list", "many", "detail"],
      });
    },
    refreshRecord: context.mode === "edit" ? context.refreshRecord : undefined,
    clearUploads: () => {
      for (const upload of Object.values(uploads)) upload.clearCompleted();
    },
    redirect: context.mode === "create" ? context.redirectAfterCreate : undefined,
    getLastError: context.getLastError,
    getErrorMessage: definition.page?.getErrorMessage ?? (() => "تعذّر حفظ البيانات. حاول مرة أخرى."),
    notifyError: (message) => { toast.error(message); },
    notifySuccess: successMessage ? () => { toast.success(successMessage); } : undefined,
  }, guard.current), [context, definition, uploads, invalidate, successMessage]);
}
