import { ResourceEditor } from "./resource-editor";
import { ResourceFormDialog } from "./resource-form-dialog";

/** Dialog-specific resource form presentation and its feature adapter. */
export const resourceDialogForms = {
  Editor: ResourceEditor,
  Form: ResourceFormDialog,
} as const;

export { ResourceEditor } from "./resource-editor";
export { ResourceFormDialog } from "./resource-form-dialog";
export type { ResourceFormDialogContext } from "./resource-form-dialog";
