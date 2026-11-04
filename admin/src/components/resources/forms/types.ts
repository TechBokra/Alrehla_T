import type { BaseRecord } from "@refinedev/core";
import type { ResolveImages, ResourceUploadHandles } from "@/hooks/uploads";

/** State and actions shared by feature fields rendered in a resource dialog. */
export interface ResourceFormDialogContext<TRecord> {
  record?: TRecord;
  formId: string;
  disabled: boolean;
  onFormValidityChange: (isValid: boolean) => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  uploads: ResourceUploadHandles;
  resolveImages: ResolveImages;
  submit: (
    prepare: () => Record<string, unknown> | Promise<Record<string, unknown>>,
  ) => Promise<void>;
}
