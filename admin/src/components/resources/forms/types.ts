import type { BaseRecord } from "@refinedev/core";

/** State and actions shared by feature fields rendered in a resource dialog. */
export interface ResourceFormDialogContext<TRecord> {
  record?: TRecord;
  formId: string;
  disabled: boolean;
  onFormValidityChange: (isValid: boolean) => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}

/** Refine CRUD state passed from the shared route page to a feature form. */
export interface ResourceFormPageContext<TRecord extends BaseRecord> {
  record?: TRecord;
  mode: "create" | "edit";
  disabled: boolean;
  pending: boolean;
  save: (values: Record<string, unknown>) => Promise<TRecord | false>;
  getLastError: () => unknown;
}
