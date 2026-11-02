import type { BaseRecord } from "@refinedev/core";

/** State and actions shared by feature fields rendered in a resource dialog. */
export interface ResourceFormDialogContext<TRecord> {
  record?: TRecord;
  formId: string;
  disabled: boolean;
  onFormValidityChange: (isValid: boolean) => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}
